import mongoose from "mongoose"
import ExpenseTracker from "../models/ExpenseTracker.js"
import ExpenseProject from "../models/ExpenseProject.js"

const toObjectId = (value) => new mongoose.Types.ObjectId(String(value))

const parseDateRangeFilter = (startDate, endDate) => {
  if (!startDate || !endDate) return undefined
  return {
    $gte: new Date(startDate),
    $lte: new Date(endDate),
  }
}

const buildExpenseFilter = ({ farmerId, projectId, category, startDate, endDate }) => {
  const filter = { farmer: farmerId }
  if (projectId) filter.project = projectId
  if (category) filter.category = category

  const dateFilter = parseDateRangeFilter(startDate, endDate)
  if (dateFilter) filter.date = dateFilter
  return filter
}

const getExpenseReport = async (filter) => {
  const expenses = await ExpenseTracker.find(filter)
    .populate("project", "name")
    .sort({ date: -1, createdAt: -1 })

  const normalizedFilter = { ...filter }
  if (normalizedFilter.farmer && typeof normalizedFilter.farmer === "string") {
    normalizedFilter.farmer = toObjectId(normalizedFilter.farmer)
  }
  if (normalizedFilter.project && typeof normalizedFilter.project === "string") {
    normalizedFilter.project = toObjectId(normalizedFilter.project)
  }

  const categoryTotals = await ExpenseTracker.aggregate([
    { $match: normalizedFilter },
    {
      $group: {
        _id: "$category",
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { total: -1 } },
  ])

  const dateWiseBreakdown = await ExpenseTracker.aggregate([
    { $match: normalizedFilter },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$date",
          },
        },
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 } },
  ])

  const totalExpense = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)

  return {
    expenses,
    categoryTotals,
    dateWiseBreakdown,
    totalExpense,
  }
}

// ------------------------
// Project management
// ------------------------
export const getProjects = async (req, res) => {
  try {
    const farmerId = req.user.id
    const projects = await ExpenseProject.find({ farmer: farmerId }).sort({ createdAt: -1 })

    const projectIds = projects.map((project) => project._id)
    const totals = projectIds.length
      ? await ExpenseTracker.aggregate([
          {
            $match: {
              farmer: toObjectId(farmerId),
              project: { $in: projectIds },
            },
          },
          {
            $group: {
              _id: "$project",
              totalExpense: { $sum: "$amount" },
              expenseCount: { $sum: 1 },
              lastExpenseDate: { $max: "$date" },
            },
          },
        ])
      : []

    const totalsMap = new Map(totals.map((item) => [String(item._id), item]))
    const projectsWithStats = projects.map((project) => {
      const stats = totalsMap.get(String(project._id))
      return {
        ...project.toObject(),
        totalExpense: Number(stats?.totalExpense || 0),
        expenseCount: Number(stats?.expenseCount || 0),
        lastExpenseDate: stats?.lastExpenseDate || null,
      }
    })

    res.json({ success: true, projects: projectsWithStats })
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message })
  }
}

export const createProject = async (req, res) => {
  try {
    const farmerId = req.user.id
    const { name, description } = req.body

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: "Project name is required" })
    }

    const project = await ExpenseProject.create({
      farmer: farmerId,
      name: String(name).trim(),
      description: description ? String(description).trim() : "",
    })

    res.status(201).json({ success: true, message: "Project created successfully", project })
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message })
  }
}

export const getProject = async (req, res) => {
  try {
    const farmerId = req.user.id
    const { projectId } = req.params

    const project = await ExpenseProject.findOne({ _id: projectId, farmer: farmerId })
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" })
    }

    res.json({ success: true, project })
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message })
  }
}

export const updateProject = async (req, res) => {
  try {
    const farmerId = req.user.id
    const { projectId } = req.params
    const { name, description } = req.body

    const updatePayload = {}
    if (name !== undefined) updatePayload.name = String(name).trim()
    if (description !== undefined) updatePayload.description = String(description).trim()

    const project = await ExpenseProject.findOneAndUpdate(
      { _id: projectId, farmer: farmerId },
      updatePayload,
      { new: true },
    )

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" })
    }

    res.json({ success: true, message: "Project updated successfully", project })
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message })
  }
}

export const deleteProject = async (req, res) => {
  try {
    const farmerId = req.user.id
    const { projectId } = req.params

    const project = await ExpenseProject.findOneAndDelete({ _id: projectId, farmer: farmerId })
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" })
    }

    await ExpenseTracker.deleteMany({ farmer: farmerId, project: projectId })
    res.json({ success: true, message: "Project and linked expenses deleted successfully" })
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message })
  }
}

// ------------------------
// Expense management within project
// ------------------------
export const getProjectExpenses = async (req, res) => {
  try {
    const farmerId = req.user.id
    const { projectId } = req.params
    const { category, startDate, endDate } = req.query

    const project = await ExpenseProject.findOne({ _id: projectId, farmer: farmerId })
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" })
    }

    const filter = buildExpenseFilter({
      farmerId,
      projectId,
      category,
      startDate,
      endDate,
    })
    const report = await getExpenseReport(filter)

    res.json({
      success: true,
      project,
      ...report,
    })
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message })
  }
}

export const createProjectExpense = async (req, res) => {
  try {
    const farmerId = req.user.id
    const { projectId } = req.params
    const { title, category, amount, date, notes, description } = req.body

    const project = await ExpenseProject.findOne({ _id: projectId, farmer: farmerId })
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" })
    }

    const resolvedTitle = String(title || description || "").trim()
    if (!resolvedTitle || !category || amount == null) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: title, category, amount",
      })
    }

    const expense = await ExpenseTracker.create({
      farmer: farmerId,
      project: projectId,
      title: resolvedTitle,
      description: description || resolvedTitle,
      category,
      amount: Number(amount),
      date: date || new Date(),
      notes,
    })

    await expense.populate("project", "name")
    res.status(201).json({ success: true, message: "Expense created successfully", expense })
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message })
  }
}

export const updateProjectExpense = async (req, res) => {
  try {
    const farmerId = req.user.id
    const { projectId, expenseId } = req.params
    const { title, category, amount, date, notes, description } = req.body

    const project = await ExpenseProject.findOne({ _id: projectId, farmer: farmerId })
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" })
    }

    const updatePayload = {}
    if (title !== undefined || description !== undefined) {
      const resolvedTitle = String(title || description || "").trim()
      if (resolvedTitle) {
        updatePayload.title = resolvedTitle
        updatePayload.description = description !== undefined ? String(description).trim() : resolvedTitle
      }
    }
    if (category !== undefined) updatePayload.category = category
    if (amount !== undefined) updatePayload.amount = Number(amount)
    if (date !== undefined) updatePayload.date = date
    if (notes !== undefined) updatePayload.notes = notes

    const expense = await ExpenseTracker.findOneAndUpdate(
      { _id: expenseId, farmer: farmerId, project: projectId },
      updatePayload,
      { new: true },
    ).populate("project", "name")

    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense not found" })
    }

    res.json({ success: true, message: "Expense updated successfully", expense })
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message })
  }
}

export const deleteProjectExpense = async (req, res) => {
  try {
    const farmerId = req.user.id
    const { projectId, expenseId } = req.params

    const expense = await ExpenseTracker.findOneAndDelete({
      _id: expenseId,
      farmer: farmerId,
      project: projectId,
    })

    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense not found" })
    }

    res.json({ success: true, message: "Expense deleted successfully" })
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message })
  }
}

// ------------------------
// Backward-compatible legacy endpoints
// ------------------------
export const getExpenses = async (req, res) => {
  try {
    const farmerId = req.user.id
    const { projectId, category, startDate, endDate } = req.query

    const filter = buildExpenseFilter({
      farmerId,
      projectId,
      category,
      startDate,
      endDate,
    })
    const report = await getExpenseReport(filter)

    res.json({
      success: true,
      ...report,
    })
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message })
  }
}

export const getExpense = async (req, res) => {
  try {
    const { expenseId } = req.params
    const farmerId = req.user.id

    const expense = await ExpenseTracker.findOne({
      _id: expenseId,
      farmer: farmerId,
    }).populate("project", "name")

    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense not found" })
    }

    res.json({ success: true, expense })
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message })
  }
}

export const createExpense = async (req, res) => {
  try {
    const farmerId = req.user.id
    const { projectId, title, category, amount, date, notes, description } = req.body

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "projectId is required. Create/select a project first.",
      })
    }

    const project = await ExpenseProject.findOne({ _id: projectId, farmer: farmerId })
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" })
    }

    const resolvedTitle = String(title || description || "").trim()
    if (!resolvedTitle || !category || amount == null) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: title, category, amount",
      })
    }

    const expense = await ExpenseTracker.create({
      farmer: farmerId,
      project: projectId,
      title: resolvedTitle,
      description: description || resolvedTitle,
      category,
      amount: Number(amount),
      date: date || new Date(),
      notes,
    })

    await expense.populate("project", "name")
    res.status(201).json({
      success: true,
      message: "Expense created successfully",
      expense,
    })
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message })
  }
}

export const updateExpense = async (req, res) => {
  try {
    const { expenseId } = req.params
    const farmerId = req.user.id
    const { projectId, title, category, amount, date, notes, description } = req.body

    const updatePayload = {}
    if (projectId !== undefined) updatePayload.project = projectId
    if (title !== undefined || description !== undefined) {
      const resolvedTitle = String(title || description || "").trim()
      if (resolvedTitle) {
        updatePayload.title = resolvedTitle
        updatePayload.description = description !== undefined ? String(description).trim() : resolvedTitle
      }
    }
    if (category !== undefined) updatePayload.category = category
    if (amount !== undefined) updatePayload.amount = Number(amount)
    if (date !== undefined) updatePayload.date = date
    if (notes !== undefined) updatePayload.notes = notes

    const expense = await ExpenseTracker.findOneAndUpdate(
      { _id: expenseId, farmer: farmerId },
      updatePayload,
      { new: true },
    ).populate("project", "name")

    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense not found" })
    }

    res.json({
      success: true,
      message: "Expense updated successfully",
      expense,
    })
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message })
  }
}

export const deleteExpense = async (req, res) => {
  try {
    const { expenseId } = req.params
    const farmerId = req.user.id

    const expense = await ExpenseTracker.findOneAndDelete({
      _id: expenseId,
      farmer: farmerId,
    })

    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense not found" })
    }

    res.json({
      success: true,
      message: "Expense deleted successfully",
    })
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message })
  }
}

export const getExpenseStats = async (req, res) => {
  try {
    const farmerId = req.user.id
    const { month, year, projectId } = req.query

    const filter = { farmer: farmerId }
    if (projectId) filter.project = projectId

    if (month && year) {
      const startOfMonth = new Date(year, month - 1, 1)
      const endOfMonth = new Date(year, month, 1)
      filter.date = {
        $gte: startOfMonth,
        $lt: endOfMonth,
      }
    }

    const normalizedFilter = { ...filter }
    if (typeof normalizedFilter.farmer === "string") {
      normalizedFilter.farmer = toObjectId(normalizedFilter.farmer)
    }
    if (typeof normalizedFilter.project === "string") {
      normalizedFilter.project = toObjectId(normalizedFilter.project)
    }

    const stats = await ExpenseTracker.aggregate([
      { $match: normalizedFilter },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
          avgAmount: { $avg: "$amount" },
        },
      },
      { $sort: { total: -1 } },
    ])

    const totalExpense = stats.reduce((sum, stat) => sum + Number(stat.total || 0), 0)

    res.json({
      success: true,
      stats,
      totalExpense,
    })
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message })
  }
}
