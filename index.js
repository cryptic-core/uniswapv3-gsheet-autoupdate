require('dotenv').config()
const credentialsPath = './credentials.json'
const { GoogleSpreadsheet } = require('google-spreadsheet')
const v3calc = require('./v3-value-calculator')
const ONEDAY = (86400000 - 1)


const getRows = async (docID, sheetIDX) => {
    const doc = new GoogleSpreadsheet(docID);
    const creds = require(credentialsPath);
    await doc.useServiceAccountAuth(creds);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[sheetIDX]
    const rows = await sheet.getRows()
    let _rows = []
    for (row of rows) {
        _rows.push(row._rawData)
    }
    return _rows
}

const adddata = async (docID,sheetID,time,account_value) => {
    const doc = new GoogleSpreadsheet(docID)
    const creds = require(credentialsPath)
    await doc.useServiceAccountAuth(creds)
    await doc.loadInfo()
    const sheet = doc.sheetsByIndex[sheetID]
    await sheet.addRow([time,'','','',account_value])
}

const upd_day_portfolio = async (totalAccountValue) => {
    // change this
    let docID = process.env.gsheet
    let today = new Date()
    let now = Date.now()
    var datestr = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate()
    let rows = await getRows(docID,process.env.gindex)
    let firstday_row = rows[0]
    let lastday_row = rows[rows.length-1]
    let initialAsset = 0
    
    if(firstday_row.length<1){
        initialAsset = totalAccountValue
    }else{
        if(lastday_row.length>0){
            // parse last day str
            let parseddt_last = Date.parse(lastday_row[0])
            initialAsset = firstday_row[1]
            if((now-parseddt_last)>ONEDAY){
                console.log(`one day has passed , time to add new row record`)
                await adddata(docID,process.env.gindex,datestr,totalAccountValue.toFixed(2))
            }
        }
    }
}

const doReport = async() => {
    
    let spotValTotal = await v3calc.calc_protfolio_report_uniswapV3(process.env.myaddr)
    await upd_day_portfolio(parseInt(spotValTotal) )
}

const numsec_scan = 60
const tocheck_hour = {
    four:4,
    twelve:12,
    twenty:20
}
setInterval(async ()=>{

    let _hour = new Date().getUTCHours()
    let _min = new Date().getMinutes()
    let now = new Date().toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'})
    let hourspl = now.split(',')[1].split(' ')
    if(_min===0){

        let cur_UTC_hour = parseInt(hourspl[1])
        if('PM'===hourspl[2]){
            if(tocheck_hour.four===cur_UTC_hour){
                await doReport()
            }
        }
        
    }
  }
  , numsec_scan*1000)

doReport()