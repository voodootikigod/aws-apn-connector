// import puppeteer from 'puppeteer'
import playwright from 'playwright'
import * as XLSX from 'xlsx/xlsx.mjs'

async function downloadExcelFile(downloadPromise) {
  const download = await downloadPromise
  const downloadStream = await download.createReadStream()
  const buffers = []
  for await (const chunk of downloadStream) {
    buffers.push(chunk)
  }
  return XLSX.read(Buffer.concat(buffers), { type: 'buffer' })
}

/**
 * The main entry point for the APN client. It returns an object that encapsulates the APN client and all of its functions in order to allow multiple instances each with a different authentication credential to be in existence in parallel.
 *
 * @param {object} options the options to pass to playwright. This also can be provided the browserType attribute which will allow you to specify the browser instance to use ('webkit', 'chromium', 'firefox'))
 * @returns
 */
export function Client(options = {}) {
  let _browser = null
  let _context = null
  // let _page = null
  // eslint-disable-next-line no-unused-vars
  const apn = {
    /**
     * The initialization and authentication process to establish an authenticated session with the APN. This must be run before any and all other subsequent functions. This does not re-authenticate if an authentication session expires, that is left to the user of the library to handle as they see appropriate.
     *
     * @param {string} username the APN username
     * @param {string} password the APN password
     * @returns {Promise} a promise that resolves when the authentication process is complete. Resolved promise returns the APN client instance itself for chaining.
     * @throws {Error} if the authentication process fails either due to invalid credentials or some other error (network, etc.)
     */
    connect: async (username, password) => {
      try {
        if (!username || !password) {
          throw new Error('Authentication credentials are required')
        }
        if (!_browser) {
          let browserType = 'chromium'
          if (options.browserType) {
            browserType = options.browserType // could be firefox or webkit
          }
          _browser = await playwright[browserType].launch(options)
          _context = await _browser.newContext()
        }
        const page = await _context.newPage()
        await page.goto(
          'https://partnercentral.awspartner.com/partnercentral2/s/login'
        )
        await page.getByLabel('*Business email').fill(username)
        await page.getByLabel('*Password').fill(password)
        await page.getByRole('button', { name: 'Sign in' }).click()

        // wait for the authenticated dashboard page to load
        await page.waitForSelector('p.welcomeUser')
        return this
        // _page = page
        // return page
      } catch (e) {
        throw new Error(
          'Authentication with the APN was unsuccessful. Please check your credentials and try again.'
        )
      }
    },
    /** Users Module to provide scoping of the functionality */
    users: {
      allAllianceTeamMembers: async () => {},
      /**
       * Gathers an export of all active users within the APN. This is the same as the "Export All" button on the Users page. This will pull ALL registered users, not just Alliance team members, and as such may take a period of time to complete and return a large result set.
       * @returns {Promise} a promise that resolves to an array of objects representing the users in the APN. Each object contains the following properties:
       * - Full Name: the full name of the user
       * - Contact Type: The type of contact the user is (Alliance, Sales, etc.)
       * - Title: the title of the user
       * - Email: the email address of the user
       * - T&C Account Email Entered: whether or not the user has entered an email address for the T&C account (true/false)
       * - Phone: the phone number of the user
       */
      allActive: async () => {
        const page = await _context.newPage()
        await page.goto(
          'https://partnercentral.awspartner.com/UserAdministrationPage'
        )
        const downloadPromise = page.waitForEvent('download')
        await page.getByRole('link', { name: '[Export All]' }).click()
        const workbook = await downloadExcelFile(downloadPromise)
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        return XLSX.utils.sheet_to_json(worksheet)
      },
      /**
       * Deactivates a user from the APN by their name. This is the same as the "Deactivate" button on the Users page. This will deactivate the user regardless of their contact type (Alliance, Sales, etc.). Note: use of this function is irreversible and will require manual intervention to re-activate the user. Furthermore, this function CAN be used to deactivate yourself, so use with caution.
       * @param {string} name Should be the exact name of the user to deactivate. This is NOT case sensitive. It should be an identifier to yield a single individual. If more than one result is returned, an error will be thrown and no user(s) will be deactivated.
       * @returns true if the user was deactivated successfully
       * @throws {Error} if the name provided yields zero (not found) or multiple (ambiguous) results) matches from the name. Note that if an exception is thrown, no users will be deactivated, failing safely.
       */
      deactivateByName: async name => {
        const page = await _context.newPage()
        await page.goto(
          'https://partnercentral.awspartner.com/UserAdministrationPage'
        )
        await page.waitForSelector(
          'input[name="j_id0\\:form\\:j_id14\\:j_id49"]'
        )

        await page
          .locator('input[name="j_id0\\:form\\:j_id14\\:j_id49"]')
          .fill(name)
        await page
          .locator('input[name="j_id0\\:form\\:j_id14\\:j_id49"]')
          .press('Enter')

        // wait for the XHR request to finish before executing further
        await page.waitForLoadState('networkidle')

        // If anything other than 1 result is returned, throw an error.
        const count = await page
          .getByRole('link', { name: 'Deactivate' })
          .count()
        if (count !== 1) {
          throw new Error(
            `Expected 1 result for name "${name}", got ${count}. Failing safely, no users were deactivated.`
          )
        }
        page.once('dialog', dialog => {
          dialog.accept()
        })
        await page.getByRole('link', { name: 'Deactivate' }).click()
        return true
      }
    },
    opportunities: {
      all: async () => {
        const page = await _context.newPage()
        // Go to the opportunity list page to access the functions enabled there
        await page.goto(
          'https://partnercentral.awspartner.com/partnercentral2/s/pipeline-manager',
          { waitUntil: 'domcontentloaded' }
        )
        // await page.getByRole('button', { name: 'View opportunities' }).click();
        await page.getByRole('textbox', { name: 'Bulk actions' }).click()
        const downloadPromise = page.waitForEvent('download')
        await page
          .getByText('Export Opportunities - All Opportunities', {
            exact: true
          })
          .click()

        const workbook = await downloadExcelFile(downloadPromise)
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        return XLSX.utils.sheet_to_json(worksheet)
      },
      changeState: async (id, targetState) => {
        const page = await _context.newPage()
        // Go to the opportunity list page to access the functions enabled there
        await page.goto(
          'https://partnercentral.awspartner.com/partnercentral2/s/pipeline-manager',
          { waitUntil: 'domcontentloaded' }
        )
        // From all opportunties page
        await page.waitForSelector('input.input-search')
        await page.type('input.input-search', id)
        await page.$x(`//a[contains(text(), '${id}')]`)[0].click()
        await page.waitForNavigation({ waitUntil: 'networkidle2' })

        // Individual Opportunity Page
        await page.click('input[data-id="select-sobject-id"]')
        await page.$x(`//a[contains(text(), '${targetState}')]`)[0].click()
        await page.waitForNavigation({ waitUntil: 'networkidle2' })

        // Change State Page
        await page.click('.primary .slds-button')
        await page.waitForNavigation({ waitUntil: 'networkidle2' })
        return 'OK'
      }
    },
    certifications: {
      all: async () => {
        const page = await _context.newPage()
        const certifications = await getCSV(
          page,
          'https://partnercentral.awspartner.com/PartnerCertificationDetailsExport'
        )
        return certificationsCSVtoJSON(certifications, { type: 'string' })
      }
    },
    end: async () => {
      return _browser ? _browser.close() : Promise.resolve()
    }
  }

  return apn
}

export async function getCSV(_page, url) {
  const csv = await _page.evaluate(async url => {
    const d = await fetch(url, {
      method: 'GET',
      credentials: 'include'
    })
    return d.text()
  }, url)
  return csv
}
export function certificationsCSVtoJSON(csv, options = {}) {
  const workbook = XLSX.read(csv, options)
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json(worksheet)
}