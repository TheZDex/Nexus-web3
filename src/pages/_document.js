import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head >
        <title>Nexus: the next generation DeFi stable coin</title>
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <meta name="description" content="Nexus DeFi App" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
