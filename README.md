# uniswapv3-gsheet-autoupdate
### Uniswap V3 position value daily auto update to google spreadsheet.

---
setup steps

- 1. change the file .example.env to .env .
- 2. apply api key in [google developer console](https://console.cloud.google.com/apis/dashboard) 

- 3. download credential.json to this workspace
- 4. apply api key in [etherscan](https://etherscan.io/) and paste the apikey in .env 'etherscan_api_key' section.

- 5. apply api key in [infura](https://infura.io/) and paste the apikey in .env 'etherscan_api_key' section.

- 6. create a google spreadsheet and copy the sheet ID(in the URL) to .env 'gsheet' section. and don't forget to add modify the accessablity of your api account to the sheet.

- 7. change tab index(0 based) if your tab is not the first in .env gindex section.

- 8. modify your wallet address in myaddr section.

- 9. run npm i

- 10. npm run start

--- 

### Some parameters you can change
- 1. change spread sheet format 
change the `adddata` @index.js line 28 to any format you want .
[example sheet](https://docs.google.com/spreadsheets/d/1FYnawXf2flhS0Aii5ngyuWclEaFac70OYQhOkJJ1Pjw/edit?usp=sharing)

- 2. change daily auto report time `index.js` line 79 if you don't want your daily record to be adde at 4 pm.

- 3. if you do not want just to record the total value . instead to split the fee and the liquidity position
change the `v3-value-calculator.js` line 191 . which fee and liquidity pos can be seperated.