/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Img,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=Manrope:wght@400;600;700&display=swap" rel="stylesheet" />
      <style>{darkModeCss}</style>
    </Head>
    <Preview>You've been invited to join {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src="https://gcycattendance.online/icon-512.png" alt="CE Korle Bu" width="72" height="72" style={{ margin: '0 auto 10px', borderRadius: '16px' }} />
        <Text style={brand}>CEKB Group · Christ Embassy Korle Bu</Text>
        <Heading style={h1}>You've been invited</Heading>
        <Text style={text}>
          You've been invited to join{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          . Click the button below to accept the invitation and create your
          account.
        </Text>
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          Accept Invitation
        </Button>
        <Text style={footer}>
          If you weren't expecting this invitation, you can safely ignore this
          email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Manrope','Segoe UI',Helvetica,Arial,sans-serif" }
const container = { padding: '28px 26px', maxWidth: '560px', margin: '0 auto', border: '1px solid #d6e3f2', borderRadius: '24px' }
const h1 = {
  fontFamily: "'Sora','Segoe UI',Helvetica,Arial,sans-serif",
  fontSize: '24px',
  fontWeight: 800 as const,
  color: '#000f22',
  textAlign: 'center' as const,
  margin: '0 0 18px',
}
const text = {
  fontSize: '15px',
  color: '#1b2b40',
  lineHeight: '1.65',
  margin: '0 0 22px',
}
const link = { color: 'inherit', textDecoration: 'underline' }
const button = {
  backgroundColor: '#000f22',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 700 as const,
  border: '1px solid #000f22',
  borderRadius: '14px',
  padding: '14px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#5b6b80', margin: '30px 0 0', borderTop: '1px solid #e3ecf6', paddingTop: '16px' }
// Rendered as a text child, which React may HTML-escape: keep this CSS free of >, &, and quotes.
const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: #c0e6fd !important; color: #000f22 !important; }
  }
  [data-ogsc] .dm-btn { background-color: #c0e6fd !important; color: #000f22 !important; }
  [data-ogsb] .dm-btn { background-color: #c0e6fd !important; color: #000f22 !important; }
`

const brand = { fontFamily: "'Sora','Segoe UI',Helvetica,Arial,sans-serif", fontSize: '13px', fontWeight: 800 as const, color: '#3f6593', textAlign: 'center' as const, margin: '0 0 22px' }
