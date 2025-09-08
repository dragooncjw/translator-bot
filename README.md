# Translation Bot

Translation Bot for FlowGram.AI.

## Environment Configuration in Development Local

To run the server locally for debugging, use the following command:

`npm run server`

You need to create a .env file in the project root and define the following environment variables:

- APP_ID – The GitHub App ID.

- WEBHOOK_SECRET – The webhook secret used to validate payloads.(semi.io address)

- PRIVATE_KEY_PATH – The file path to your GitHub App’s private key (.pem).


Example:
```
APP_ID=your_app_id_here
WEBHOOK_SECRET=your_webhook_secret_here
PRIVATE_KEY_PATH=./path/to/your/private-key.pem
```


For detailed instructions on generating these values, refer to the GitHub Docs – [Create a .env file.](https://docs.github.com/en/apps/creating-github-apps/writing-code-for-a-github-app/quickstart#create-a-env-file)



## Run in Vercel

This project can be deployed directly to Vercel.
By default, the entry point is: `api/webhook.js`

In your GitHub App settings, configure the Webhook URL as:

```
https://<your-domain>/api/webhook.js
```

Before going live, you need to update the bot name in api/webhook.js:

```
// Replace with your GitHub App’s name
const botName = 'flowgram-translator-bot[bot]';
```


This name is used to identify whether a comment edit is initiated by the translation bot. Make sure to replace it with the actual name of your GitHub App.