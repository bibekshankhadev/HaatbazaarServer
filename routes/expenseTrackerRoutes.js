import express from "express"
import { protect } from "../middleware/auth.js"
import {
  getProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
  getProjectExpenses,
  createProjectExpense,
  updateProjectExpense,
  deleteProjectExpense,
  getExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseStats,
} from "../controllers/expenseTrackerController.js"

const router = express.Router()

// ------------------------
// Project routes
// ------------------------
router.get("/projects", protect, getProjects)
router.post("/projects", protect, createProject)
router.get("/projects/:projectId", protect, getProject)
router.put("/projects/:projectId", protect, updateProject)
router.delete("/projects/:projectId", protect, deleteProject)

// Expenses inside project
router.get("/projects/:projectId/expenses", protect, getProjectExpenses)
router.post("/projects/:projectId/expenses", protect, createProjectExpense)
router.put("/projects/:projectId/expenses/:expenseId", protect, updateProjectExpense)
router.delete("/projects/:projectId/expenses/:expenseId", protect, deleteProjectExpense)

// Get all expenses
router.get("/", protect, getExpenses)

// Get expense statistics
router.get("/stats", protect, getExpenseStats)

// Get single expense
router.get("/:expenseId", protect, getExpense)

// Create expense
router.post("/", protect, createExpense)

// Update expense
router.put("/:expenseId", protect, updateExpense)

// Delete expense
router.delete("/:expenseId", protect, deleteExpense)

export default router
