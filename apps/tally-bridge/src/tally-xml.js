/**
 * Builds Tally XML envelopes for various request types.
 * Tally Prime accepts XML over HTTP POST to port 9000.
 */

/**
 * Wraps content in a Tally ENVELOPE/BODY envelope.
 * @param {string} inner - the inner XML (TALLYMESSAGE content)
 */
function envelope(inner) {
  return `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          ${inner}
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`
}

/**
 * Build a voucher XML for a GST Return document push.
 * @param {{ companyName: string, gstin: string, filingPeriod: string, documentId: string, documentName: string, documentType: string }} params
 */
function buildVoucherXml(params) {
  const { companyName, gstin, filingPeriod, documentId, documentName, documentType } = params
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')

  const inner = `<VOUCHER REMOTEID="${escapeXml(documentId)}" VCHTYPE="Journal" ACTION="Create">
  <DATE>${date}</DATE>
  <NARRATION>GST Return — ${escapeXml(filingPeriod ?? '')} | ${escapeXml(documentName)} | GSTIN: ${escapeXml(gstin ?? '')}</NARRATION>
  <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>
  <PARTYLEDGERNAME>${escapeXml(companyName ?? '')}</PARTYLEDGERNAME>
  <UDF:GSTRETURNDOCTYPE xmlns:UDF="TallyUDF">${escapeXml(documentType)}</UDF:GSTRETURNDOCTYPE>
  <UDF:GSTRETURNPERIOD xmlns:UDF="TallyUDF">${escapeXml(filingPeriod ?? '')}</UDF:GSTRETURNPERIOD>
  <UDF:GSTIN xmlns:UDF="TallyUDF">${escapeXml(gstin ?? '')}</UDF:GSTIN>
  <UDF:OPSCCOPILOT_ID xmlns:UDF="TallyUDF">${escapeXml(documentId)}</UDF:OPSCCOPILOT_ID>
</VOUCHER>`

  return envelope(inner)
}

/**
 * Build a status query XML for a GSTIN + period.
 */
function buildStatusQueryXml(gstin, period) {
  return `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>GSTR Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <SVFROMDATE>${escapeXml(period)}</SVFROMDATE>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`
}

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

module.exports = { buildVoucherXml, buildStatusQueryXml }
