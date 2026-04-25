import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { extractTextFromUploadedFile, inferDocumentKind } from './documentParser.js'

function makeFile(filename: string, mimetype: string, contents: Buffer | string): Express.Multer.File {
  const buffer = Buffer.isBuffer(contents) ? contents : Buffer.from(contents, 'utf8')

  return {
    fieldname: 'file',
    originalname: filename,
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    buffer,
    stream: null as never,
    destination: '',
    filename,
    path: '',
  }
}

describe('documentParser', () => {
  it('infers CSV and XLSX document kinds', () => {
    assert.equal(inferDocumentKind('data.csv', 'text/csv'), 'csv')
    assert.equal(
      inferDocumentKind('budget.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      'xlsx',
    )
    assert.equal(inferDocumentKind('legacy.xls', 'application/vnd.ms-excel'), 'xlsx')
  })

  it('keeps CSV content as text', async () => {
    const text = await extractTextFromUploadedFile(makeFile('eligibility.csv', 'text/csv', 'name,age\n小明,22\n'))

    assert.equal(text, 'name,age\n小明,22')
  })

  it('strips script/style and tags from HTML', async () => {
    const html = `
      <html>
        <head><style>.hidden { display: none; }</style></head>
        <body>
          <h1>青年補助</h1>
          <script>alert("ignore")</script>
          <p>申請資格：18 到 29 歲</p>
        </body>
      </html>
    `

    const text = await extractTextFromUploadedFile(makeFile('page.html', 'text/html', html))

    assert.match(text, /青年補助/)
    assert.match(text, /申請資格：18 到 29 歲/)
    assert.doesNotMatch(text, /alert/)
    assert.doesNotMatch(text, /display/)
  })

  it('converts XLSX sheets to CSV-like text', async () => {
    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([
      ['name', 'score'],
      ['小明', 88],
    ])
    XLSX.utils.book_append_sheet(workbook, sheet, 'Applicants')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    const text = await extractTextFromUploadedFile(makeFile(
      'applicants.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    ))

    assert.match(text, /# Sheet: Applicants/)
    assert.match(text, /name,score/)
    assert.match(text, /小明,88/)
  })
})
