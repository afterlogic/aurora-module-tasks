const path = require('path')
const { sharedHelper } = require(path.join(
  process.env.AURORA_E2E_ROOT,
  'helpers/paths'
))
const { expect } = require('@playwright/test')
const { step } = sharedHelper('login')
const { clickReady, clickNav, confirmOkIfVisible } = sharedHelper('ready')
const { T } = sharedHelper('timeouts')

function tasksNavTab(page) {
  return page
    .getByTestId('nav-tasks')
    .or(page.locator('.item.tasks').first())
    .or(page.locator('a[href="#tasks"]').first())
    .first()
}

async function navigateToTasksRoute(page) {
  const tab = tasksNavTab(page)
  const hasNavTestId = await page
    .getByTestId('nav-tasks')
    .isVisible()
    .catch(() => false)
  if (hasNavTestId) {
    await clickNav(page, 'nav-tasks')
  } else {
    await clickReady(tab.locator('a.link, a').first())
  }

  const onTasksHash = await page
    .waitForURL(/#tasks/i, { timeout: T(15000) })
    .then(() => true)
    .catch(() => false)

  if (!onTasksHash) {
    await page.evaluate(() => {
      window.location.hash = 'tasks'
    })
    await page.waitForURL(/#tasks/i, { timeout: T(15000) }).catch(() => undefined)
  }
}

function tasksScreen(page) {
  return page
    .getByTestId('tasks-screen')
    .or(page.locator('.screen.TasksLayout'))
    .first()
}

function tasksCreateButton(page) {
  return page
    .getByTestId('tasks-create')
    .or(
      page.locator('.screen.TasksLayout:visible .buttons.big_single_button .button').first()
    )
    .first()
}

function taskItemBySubject(page, subject) {
  const subjectCell = page.locator('.task_subject', { hasText: subject })
  return page
    .getByTestId('tasks-item')
    .filter({ has: subjectCell })
    .or(page.locator('.screen.TasksLayout .items_sub_list .item').filter({ has: subjectCell }))
    .first()
}

async function openTasks(page) {
  await step('Open Tasks', async () => {
    const tab = tasksNavTab(page)
    const visible = await tab
      .waitFor({ state: 'visible', timeout: T(30000) })
      .then(() => true)
      .catch(() => false)
    if (!visible) {
      console.log('  → Tasks nav tab not visible')
      return false
    }

    await navigateToTasksRoute(page)

    await expect(tasksScreen(page)).toBeVisible({
      timeout: T(60000),
    })
    await expect(tasksCreateButton(page)).toBeVisible({
      timeout: T(30000),
    })
    return true
  })
}

async function waitForTasksList(page) {
  await expect(tasksScreen(page)).toBeVisible({
    timeout: T(60000),
  })
  await expect
    .poll(
      async () => {
        const loading = page.locator('#selenium_contacts_loading_info:visible')
        if (await loading.count()) {
          return false
        }
        return true
      },
      { timeout: T(60000), intervals: [500, 1000] }
    )
    .toBe(true)
}

async function createTask(page, subject) {
  await clickReady(tasksCreateButton(page))
  const dialog = page.getByTestId('calendar-event-dialog')
  await expect(dialog).toBeVisible({ timeout: T(15000) })
  const subjectField = page.getByTestId('calendar-event-subject')
  await subjectField.fill(subject)
  await clickReady(page.getByTestId('calendar-event-save'))
  await expect(dialog).toBeHidden({ timeout: T(60000) })
  await waitForTasksList(page)
}

async function openTaskBySubject(page, subject) {
  const item = taskItemBySubject(page, subject)
  await expect(item).toBeVisible({ timeout: T(60000) })
  const target = item.locator('.task_subject').first()
  await target.evaluate((el) => {
    if (window.jQuery) {
      window.jQuery(el).trigger('dblclick')
      return
    }
    el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  })
  await expect(page.getByTestId('calendar-event-dialog')).toBeVisible({
    timeout: T(15000),
  })
}

async function completeTaskBySubject(page, subject) {
  const item = taskItemBySubject(page, subject)
  await expect(item).toBeVisible({ timeout: T(30000) })
  const checkbox = item
    .getByTestId('tasks-item-check')
    .or(item.locator('label.custom_checkbox.round').first())
    .first()
  await checkbox.evaluate((el) => {
    if (window.jQuery) {
      window.jQuery(el).trigger('click')
      return
    }
    el.click()
  })
  await expect(item.locator('.task_subject')).toHaveCSS(
    'text-decoration-line',
    /line-through/
  )
}

async function deleteTaskFromDialog(page) {
  const dialog = page.getByTestId('calendar-event-dialog')
  await expect(dialog).toBeVisible({ timeout: T(15000) })
  const remove = page.getByTestId('calendar-event-delete')
  await expect(remove).toBeVisible({ timeout: T(15000) })
  await clickReady(remove)
  await confirmOkIfVisible(page, 15000)
  await expect(dialog).toBeHidden({ timeout: T(60000) })
}

module.exports = {
  openTasks,
  waitForTasksList,
  createTask,
  taskItemBySubject,
  openTaskBySubject,
  completeTaskBySubject,
  deleteTaskFromDialog,
}
