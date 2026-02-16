import Order from "../models/Order.js"
import Product from "../models/Product.js"
import { createNotification } from "./notificationController.js"
import axios from "axios"
import crypto from "crypto"

const getShortOrderId = (orderId) => String(orderId || "").slice(-6)
const getRefId = (ref) => String(ref?._id || ref || "")

const ESEWA_ENV = process.env.ESEWA_ENV === "production" ? "production" : "sandbox"
const ESEWA_SIGNED_FIELD_NAMES = ["total_amount", "transaction_uuid", "product_code"]
const ESEWA_CONFIG = {
  sandbox: {
    formUrl: "https://rc-epay.esewa.com.np/api/epay/main/v2/form",
    statusUrl: "https://rc.esewa.com.np/api/epay/transaction/status/",
    productCode: "EPAYTEST",
    secretKey: "8gBm/:&EnhH.1/q",
  },
  production: {
    formUrl: "https://epay.esewa.com.np/api/epay/main/v2/form",
    statusUrl: "https://epay.esewa.com.np/api/epay/transaction/status/",
    productCode: process.env.ESEWA_PRODUCT_CODE || "",
    secretKey: process.env.ESEWA_SECRET_KEY || "",
  },
}

const getEsewaConfig = () => {
  const fallback = ESEWA_CONFIG[ESEWA_ENV]
  return {
    formUrl: process.env.ESEWA_FORM_URL || fallback.formUrl,
    statusUrl: process.env.ESEWA_STATUS_URL || fallback.statusUrl,
    productCode: process.env.ESEWA_PRODUCT_CODE || fallback.productCode,
    secretKey: process.env.ESEWA_SECRET_KEY || fallback.secretKey,
    successUrl: process.env.ESEWA_SUCCESS_URL || "https://developer.esewa.com.np/success",
    failureUrl: process.env.ESEWA_FAILURE_URL || "https://developer.esewa.com.np/failure",
  }
}

const formatAmount = (value) => Number(value || 0).toFixed(2)

const buildSignedMessage = (fields, payload) =>
  fields.map((field) => `${field}=${payload[field] ?? ""}`).join(",")

const generateEsewaSignature = (message, secretKey) =>
  crypto.createHmac("sha256", secretKey).update(message).digest("base64")

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

// Create a new order
export const createOrder = async (req, res) => {
  try {
    const {
      farmerId,
      products,
      deliveryLocation,
      deliveryOption = "self_pickup",
      paymentMethod = "cash_on_delivery",
    } = req.body
    const buyerId = req.user.id

    if (!farmerId || !products || products.length === 0) {
      return res.status(400).json({ message: "Missing required fields" })
    }

    if (!["self_pickup", "request_delivery"].includes(deliveryOption)) {
      return res.status(400).json({ message: "Invalid delivery option" })
    }

    if (!["cash_on_delivery", "esewa"].includes(paymentMethod)) {
      return res.status(400).json({ message: "Invalid payment method" })
    }

    const isDeliveryRequested = deliveryOption === "request_delivery"

    if (
      isDeliveryRequested &&
      (deliveryLocation?.latitude == null || deliveryLocation?.longitude == null)
    ) {
      return res.status(400).json({ message: "Delivery location is required for delivery request" })
    }

    // Validate products and calculate total
    let totalAmount = 0
    for (const item of products) {
      const product = await Product.findById(item.product)
      if (!product) {
        return res.status(404).json({ message: `Product ${item.product} not found` })
      }
      if (product.quantity < item.quantity) {
        return res.status(400).json({ message: `Insufficient quantity for ${product.title}` })
      }
      totalAmount += product.price * item.quantity
    }

    if (isDeliveryRequested) {
      totalAmount += 50
    }

    const order = new Order({
      buyer: buyerId,
      farmer: farmerId,
      products,
      totalAmount,
      deliveryLocation,
      deliveryOption,
      deliveryStatus: isDeliveryRequested ? "pending" : "completed",
      deliveryRequest: isDeliveryRequested
        ? {
            isRequested: true,
            requestedAt: new Date(),
          }
        : {
            isRequested: false,
          },
      paymentMethod,
      paymentStatus: "pending",
      status: "placed",
    })

    await order.save()
    await order.populate("buyer", "name phone profilePic")
    await order.populate("farmer", "name phone address profilePic")
    await order.populate("products.product", "title price imageUrl")

    if (isDeliveryRequested) {
      await createNotification(
        farmerId,
        buyerId,
        "delivery_request",
        "Delivery request received",
        `${order.buyer?.name || "A buyer"} requested delivery for order #${order._id
          .toString()
          .slice(-6)}.`,
        { orderId: order._id, farmerId },
      )
    } else {
      await createNotification(
        farmerId,
        buyerId,
        "order_placed",
        "New order placed",
        `${order.buyer?.name || "A buyer"} placed a self pickup order #${order._id
          .toString()
          .slice(-6)}.`,
        { orderId: order._id, farmerId },
      )
    }

    await createNotification(
      buyerId,
      farmerId,
      "order_status",
      "Order pending",
      `Your order #${getShortOrderId(order._id)} is pending.`,
      { orderId: order._id, farmerId },
    )

    res.status(201).json({ message: "Order created successfully", order })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Get orders for a user (buyer or farmer)
export const getOrders = async (req, res) => {
  try {
    const userId = req.user.id
    const { role } = req.query

    let filter = {}
    if (role === "buyer") {
      filter = { buyer: userId }
    } else if (role === "farmer") {
      filter = { farmer: userId }
    } else {
      filter = { $or: [{ buyer: userId }, { farmer: userId }] }
    }

    const orders = await Order.find(filter)
      .populate("buyer", "name phone profilePic")
      .populate("farmer", "name phone address profilePic")
      .populate("products.product", "title price imageUrl category")
      .sort({ createdAt: -1 })

    res.json(orders)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Get single order details
export const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("buyer", "name phone address profilePic location")
      .populate("farmer", "name phone address profilePic location")
      .populate("products.product", "title price imageUrl category description")

    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    if (
      req.user.role !== "admin" &&
      getRefId(order.buyer) !== req.user.id &&
      getRefId(order.farmer) !== req.user.id
    ) {
      return res.status(403).json({ message: "Unauthorized" })
    }

    res.json(order)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Update order status (farmer accepts/rejects)
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body

    if (!["accepted", "packing", "rejected", "shipped", "delivered", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" })
    }

    const order = await Order.findById(req.params.id)

    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    if (order.farmer.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized" })
    }

    const previousStatus = order.status
    const normalizedStatus = status === "accepted" ? "packing" : status
    order.status = normalizedStatus

    if (
      order.deliveryOption === "request_delivery" &&
      ["accepted", "packing", "rejected"].includes(status)
    ) {
      const deliveryResponse = status === "rejected" ? "rejected" : "accepted"
      order.deliveryStatus = deliveryResponse
      order.deliveryRequest = {
        ...(order.deliveryRequest || {}),
        isRequested: true,
        respondedAt: new Date(),
        response: deliveryResponse,
      }

      await createNotification(
        order.buyer,
        req.user.id,
        deliveryResponse === "accepted" ? "delivery_accepted" : "delivery_rejected",
        deliveryResponse === "accepted" ? "Delivery request accepted" : "Delivery request rejected",
        deliveryResponse === "accepted"
          ? `Your delivery request for order #${order._id.toString().slice(-6)} was accepted.`
          : `Your delivery request for order #${order._id.toString().slice(-6)} was rejected.`,
        { orderId: order._id, farmerId: order.farmer },
      )
    }

    if (normalizedStatus === "packing") {
      await createNotification(
        order.buyer,
        req.user.id,
        "order_status",
        "Order packing",
        `Your order #${getShortOrderId(order._id)} is being packed.`,
        { orderId: order._id, farmerId: order.farmer },
      )
    }

    if (normalizedStatus === "shipped") {
      const isDeliveryOrder = order.deliveryOption === "request_delivery"
      const readyLabel = isDeliveryOrder ? "delivery" : "pickup"

      if (isDeliveryOrder) {
        order.deliveryStatus = "in_transit"
      }

      await createNotification(
        order.buyer,
        req.user.id,
        "order_status",
        `Order ready for ${readyLabel}`,
        `Your order #${getShortOrderId(order._id)} is ready for ${readyLabel}.`,
        { orderId: order._id, farmerId: order.farmer },
      )
    }

    if (normalizedStatus === "delivered") {
      if (previousStatus !== "delivered" && !order.inventoryDeducted) {
        const deductedItems = []

        for (const item of order.products) {
          const productId = getRefId(item.product)
          const updatedProduct = await Product.findOneAndUpdate(
            { _id: productId, farmer: order.farmer, quantity: { $gte: item.quantity } },
            { $inc: { quantity: -item.quantity } },
            { new: true },
          )

          if (!updatedProduct) {
            for (const deductedItem of deductedItems) {
              await Product.findByIdAndUpdate(deductedItem.productId, {
                $inc: { quantity: deductedItem.quantity },
              })
            }

            return res.status(400).json({
              message: "Insufficient product quantity to complete delivery",
            })
          }

          deductedItems.push({ productId, quantity: item.quantity })
        }

        order.inventoryDeducted = true
      }

      order.deliveryStatus = "completed"
      if (previousStatus !== "delivered") {
        await createNotification(
          order.buyer,
          req.user.id,
          "order_status",
          "Order delivered",
          `Your order #${getShortOrderId(order._id)} has been delivered.`,
          { orderId: order._id, farmerId: order.farmer },
        )
      }
    }

    await order.save()
    await order.populate("buyer", "name phone profilePic")
    await order.populate("farmer", "name phone profilePic")
    await order.populate("products.product", "title price")

    res.json({ message: `Order status updated to ${normalizedStatus}`, order })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Buyer cancels order
export const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)

    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    if (order.buyer.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized" })
    }

    if (["shipped", "delivered"].includes(order.status)) {
      return res.status(400).json({ message: "Cannot cancel order in current status" })
    }

    order.status = "cancelled"
    await order.save()

    res.json({ message: "Order cancelled successfully", order })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

export const renderEsewaCheckoutForm = async (req, res) => {
  try {
    const { form_url: formUrl, ...fields } = req.query || {}

    if (!formUrl) {
      return res.status(400).send("Missing form_url")
    }

    const requiredFields = [
      "amount",
      "tax_amount",
      "total_amount",
      "transaction_uuid",
      "product_code",
      "product_service_charge",
      "product_delivery_charge",
      "success_url",
      "failure_url",
      "signed_field_names",
      "signature",
    ]

    const missingFields = requiredFields.filter((field) => !fields[field])
    if (missingFields.length > 0) {
      return res.status(400).send(`Missing required fields: ${missingFields.join(", ")}`)
    }

    const hiddenInputs = Object.entries(fields)
      .map(
        ([key, value]) =>
          `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}" />`,
      )
      .join("\n")

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Redirecting to eSewa</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
    </style>
  </head>
  <body>
    <p>Redirecting to eSewa...</p>
    <form id="esewa-form" action="${escapeHtml(formUrl)}" method="POST">
      ${hiddenInputs}
    </form>
    <script>
      document.getElementById("esewa-form").submit();
    </script>
  </body>
</html>`

    res.setHeader("Content-Type", "text/html; charset=utf-8")
    res.status(200).send(html)
  } catch (error) {
    res.status(500).send(`Failed to prepare eSewa checkout form: ${error.message}`)
  }
}

const verifyEsewaCallbackSignature = (callbackPayload, secretKey) => {
  const signedFieldNames = String(callbackPayload?.signed_field_names || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)

  if (!signedFieldNames.length || !callbackPayload?.signature) {
    throw new Error("Missing signed fields or signature in callback data")
  }

  const signedMessage = buildSignedMessage(signedFieldNames, callbackPayload)
  const expectedSignature = generateEsewaSignature(signedMessage, secretKey)

  if (expectedSignature !== callbackPayload.signature) {
    throw new Error("Invalid eSewa callback signature")
  }

  return signedFieldNames
}

export const initiateEsewaPayment = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)

    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    if (getRefId(order.buyer) !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized" })
    }

    if (order.paymentMethod !== "esewa") {
      return res.status(400).json({ message: "Order is not configured for eSewa payment" })
    }

    if (order.paymentStatus === "paid") {
      return res.status(400).json({ message: "Order payment is already completed" })
    }

    const esewaConfig = getEsewaConfig()
    if (!esewaConfig.productCode || !esewaConfig.secretKey) {
      return res.status(500).json({ message: "eSewa configuration is incomplete on the server" })
    }

    const transactionUuid = `${order._id}-${Date.now()}`
    const amount = formatAmount(order.totalAmount)
    const payload = {
      amount,
      tax_amount: "0",
      total_amount: amount,
      transaction_uuid: transactionUuid,
      product_code: esewaConfig.productCode,
      product_service_charge: "0",
      product_delivery_charge: "0",
      success_url: esewaConfig.successUrl,
      failure_url: esewaConfig.failureUrl,
      signed_field_names: ESEWA_SIGNED_FIELD_NAMES.join(","),
    }

    const signedMessage = buildSignedMessage(ESEWA_SIGNED_FIELD_NAMES, payload)
    payload.signature = generateEsewaSignature(signedMessage, esewaConfig.secretKey)

    order.paymentStatus = "pending"
    order.paymentDetails = {
      ...(order.paymentDetails || {}),
      transactionUuid,
      amount: Number(payload.total_amount),
      esewaStatus: "INITIATED",
      statusCheckedAt: new Date(),
    }
    await order.save()

    const response = {
      environment: ESEWA_ENV,
      formUrl: esewaConfig.formUrl,
      formData: payload,
    }

    if (ESEWA_ENV === "sandbox") {
      response.testCredentials = {
        esewaId: ["9806800001", "9806800002", "9806800003", "9806800004", "9806800005"],
        password: "Nepal@123",
        mpin: "1122",
        token: "123456",
      }
    }

    res.json(response)
  } catch (error) {
    res.status(500).json({ message: "Failed to initiate eSewa payment", error: error.message })
  }
}

export const verifyEsewaPayment = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)

    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    if (getRefId(order.buyer) !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized" })
    }

    if (order.paymentMethod !== "esewa") {
      return res.status(400).json({ message: "Order is not configured for eSewa payment" })
    }

    if (order.paymentStatus === "paid") {
      return res.json({
        message: "Payment already verified",
        paymentStatus: "paid",
        esewaStatus: order.paymentDetails?.esewaStatus || "COMPLETE",
        transactionUuid: order.paymentDetails?.transactionUuid || null,
        referenceId: order.paymentDetails?.referenceId || null,
      })
    }

    const esewaConfig = getEsewaConfig()
    if (!esewaConfig.productCode || !esewaConfig.secretKey) {
      return res.status(500).json({ message: "eSewa configuration is incomplete on the server" })
    }

    const { data: encodedData, transactionUuid: manualTransactionUuid } = req.body || {}
    let callbackPayload = null

    if (encodedData) {
      try {
        const decodedJson = Buffer.from(String(encodedData), "base64").toString("utf-8")
        callbackPayload = JSON.parse(decodedJson)
        verifyEsewaCallbackSignature(callbackPayload, esewaConfig.secretKey)
      } catch (error) {
        return res.status(400).json({ message: `Invalid eSewa callback data: ${error.message}` })
      }
    }

    const transactionUuid =
      callbackPayload?.transaction_uuid ||
      manualTransactionUuid ||
      order.paymentDetails?.transactionUuid

    if (!transactionUuid) {
      return res.status(400).json({ message: "Missing transaction UUID for verification" })
    }

    const totalAmount = formatAmount(callbackPayload?.total_amount || order.totalAmount)
    const productCode = callbackPayload?.product_code || esewaConfig.productCode
    const statusEndpoint =
      `${esewaConfig.statusUrl}?product_code=${encodeURIComponent(productCode)}` +
      `&total_amount=${encodeURIComponent(totalAmount)}` +
      `&transaction_uuid=${encodeURIComponent(transactionUuid)}`

    const statusResponse = await axios.get(statusEndpoint, { timeout: 15000 })
    const statusPayload = statusResponse?.data || {}
    const normalizedStatus = String(statusPayload.status || "").toUpperCase()

    order.paymentDetails = {
      ...(order.paymentDetails || {}),
      transactionUuid,
      referenceId: statusPayload.ref_id || order.paymentDetails?.referenceId,
      amount: Number(totalAmount),
      esewaStatus: normalizedStatus || "UNKNOWN",
      statusCheckedAt: new Date(),
    }

    if (normalizedStatus === "COMPLETE") {
      order.paymentStatus = "paid"
      order.paymentDetails.transactionId =
        statusPayload.transaction_code ||
        statusPayload.ref_id ||
        order.paymentDetails.transactionId
      order.paymentDetails.paidAt = new Date()

      await createNotification(
        order.farmer,
        order.buyer,
        "payment_received",
        "Payment received",
        `Payment for order #${getShortOrderId(order._id)} was completed via eSewa.`,
        { orderId: order._id, farmerId: order.farmer },
      )
    } else if (["NOT_FOUND", "CANCELED"].includes(normalizedStatus)) {
      order.paymentStatus = "failed"
    } else {
      order.paymentStatus = "pending"
    }

    await order.save()

    res.json({
      message:
        normalizedStatus === "COMPLETE"
          ? "Payment verified successfully"
          : "Payment is not completed yet",
      paymentStatus: order.paymentStatus,
      esewaStatus: normalizedStatus || "UNKNOWN",
      transactionUuid,
      referenceId: order.paymentDetails?.referenceId || null,
    })
  } catch (error) {
    res.status(500).json({ message: "Failed to verify eSewa payment", error: error.message })
  }
}
