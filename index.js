// import puppeteer from 'puppeteer'
import playwright from 'playwright'




  

export function Client(options = {}) {
  let _browser = null
  let _context = null
  let _page = null
  // eslint-disable-next-line no-unused-vars
  let _viewId = null
  const apn = {
    connect: async (username, password) => {
      if (!username || !password) {
        throw new Error('Authentication credentials are required')
      }
      if (!_browser) {
        _browser = await playwright.chromium.launch(options)
        _context = await _browser.newContext()
      }
      const page = await _context.newPage()
      await page.goto('https://partnercentral.awspartner.com/partnercentral2/s/login')
      await page.getByLabel('*Business email').fill(username);
      await page.getByLabel('*Password').fill(password);
      await page.getByRole('button', { name: 'Sign in' }).click();
      // need to handle jitter
      await page.waitForTimeout(2000)
      await page.waitForURL('**/s/');

/*      // email
      const emailInput = '#input-38'
      await page.type(emailInput, username)

      // password
      const passInput = '#input-44'
      await page.type(passInput, password)

      await page.click('button.slds-button.slds-button_brand')
      await page.waitForNavigation({ waitUntil: 'networkidle2' })

      // go to the home
      await page.waitForSelector('.plrs-badge')
*/
      // _viewId = 'a3H0h000000pQEbEAM'
      console.log('Authenticated into the APN')
      _page = page
      return page
    },
    users: {
      deactivateByEmail: async email => {
        const page = _page
        await page.goto(
          'https://partnercentral.awspartner.com/UserAdministrationPage'
        )
        const user = await page.waitForSelector(`a ::-p-text(${email}`)
        console.log(user)
      }
    },
    opportunities: {
      all: async () => {
        const page = _page
        // Go to the opportunity list page to access the functions enabled there
        await page.goto(
          'https://partnercentral.awspartner.com/partnercentral2/s/pipeline-manager',
          { waitUntil: 'domcontentloaded' }
        )
        // await page.getByRole('button', { name: 'View opportunities' }).click();
        await page.getByRole('textbox', { name: 'Bulk actions' }).click();
        const downloadPromise = page.waitForEvent('download');
        await page.getByText('Export Opportunities - All Opportunities', { exact: true }).click();
        const download = await downloadPromise;
        console.log(download.text())
        return download




        // await page.waitForNavigation({ waitUntil: 'networkidle2' })
        // await page.waitForTimeout(4000)
        // await page.$$(`input[title='Bulk actions']`)[0].click()
        // await page.waitForTimeout(40000)
        // const viewId = await page.evaluate(() => {
        //   // eslint-disable-next-line no-undef
        //   const ocText = document.querySelectorAll("li[title='Export Opportunities - All Opportunities']")[0].click();
        //   return ocText
        // })
        // console.log(viewId)
        // return []

        // // When settled, access the packaged functions to trigger/enable
        // // visualforce to prepare the data then gather via fetch the excel
        // // file and return
        // const opportunityXLSX = await page.evaluate(async viewId => {
        //   // eslint-disable-next-line no-undef
        //   await opportunityExportPreConfirmation(viewId)
        //   const url = `https://partnercentral.awspartner.com/ExportXls?viewId=${viewId}&fs=PartnerOpportunityExport`
        //   const d = await fetch(url, {
        //     method: 'GET',
        //     credentials: 'include'
        //   })
        //   return d.text()
        // }, viewId)

        // convert to json objects
        // return opportunitiesXLSXtoJSON(opportunityXLSX, { type: 'string' })
      },
      changeState: async (id, targetState) => {
        const page = _page
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
        const certifications = await getCSV(
          _page,
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
export function opportunitiesXLSXtoJSON(xlsx, options = {}) {
  const workbook = XLSX.read(xlsx, options)
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json(worksheet)
}
export function certificationsCSVtoJSON(csv, options = {}) {
  const workbook = XLSX.read(csv, options)
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json(worksheet)
}
