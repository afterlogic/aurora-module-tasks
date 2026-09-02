const path = require('path')
const { sharedHelper } = require(path.join(
  process.env.AURORA_E2E_ROOT,
  'helpers/paths'
))
const { test, expect } = require('@playwright/test')
const { T } = sharedHelper('timeouts')
const { gotoLoggedIn, step, attachScreenshot, hasCredentials } = sharedHelper('login')
const {
  openTasks,
  waitForTasksList,
  createTask,
  taskItemBySubject,
  openTaskBySubject,
  completeTaskBySubject,
  deleteTaskFromDialog,
} = require('./helpers/tasks')

test.describe('Desktop tasks', () => {
  test.skip(!hasCredentials(), 'Set E2E_LOGIN_PRIMARY in .env.e2e')

  test('creates, completes, and deletes a task', async ({ page }) => {
    test.setTimeout(T(300000))
    const subject = `E2E Task ${Date.now()}`

    await gotoLoggedIn(page)
    const opened = await openTasks(page)
    test.skip(!opened, 'Tasks module/tab is not available on this stand (requires CalendarWebclient + Tasks)')

    await waitForTasksList(page)

    await step('Create task', async () => {
      await createTask(page, subject)
      await expect(taskItemBySubject(page, subject)).toBeVisible({
        timeout: T(60000),
      })
      console.log(`  → Created task: ${subject}`)
      await attachScreenshot(page, 'tasks-01-created')
    })

    await step('Mark task complete', async () => {
      await completeTaskBySubject(page, subject)
      console.log('  → Task marked complete')
      await attachScreenshot(page, 'tasks-02-completed')
    })

    await step('Delete task', async () => {
      await openTaskBySubject(page, subject)
      await deleteTaskFromDialog(page)
      await expect(taskItemBySubject(page, subject)).toHaveCount(0, {
        timeout: T(60000),
      })
      console.log('  → Task deleted')
      await attachScreenshot(page, 'tasks-03-deleted')
    })
  })
})
