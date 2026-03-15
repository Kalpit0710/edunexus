import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
} from '@react-email/components'

interface FeeReceiptEmailProps {
  parentName: string
  studentName: string
  schoolName: string
  receiptNumber: string
  amountPaid: string
  paymentMode: string
  date: string
}

export const FeeReceiptEmail = ({
  parentName,
  studentName,
  schoolName,
  receiptNumber,
  amountPaid,
  paymentMode,
  date,
}: FeeReceiptEmailProps) => {
  const previewText = `Fee Receipt: ${receiptNumber} from ${schoolName}`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Payment Receipt</Heading>
          <Text style={text}>Dear {parentName},</Text>
          <Text style={text}>
            We have received a payment for <strong>{studentName}</strong>'s fees at <strong>{schoolName}</strong>. 
            Thank you for your prompt payment!
          </Text>

          <Section style={receiptSection}>
            <Text style={receiptRow}>
              <strong>Receipt No:</strong> {receiptNumber}
            </Text>
            <Text style={receiptRow}>
              <strong>Date:</strong> {date}
            </Text>
            <Text style={receiptRow}>
              <strong>Amount Paid:</strong> {amountPaid}
            </Text>
            <Text style={receiptRow}>
              <strong>Payment Mode:</strong> {paymentMode}
            </Text>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            This is an automated receipt from {schoolName}. If you notice any discrepancies, please contact the school administration.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
}

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  margin: '30px 0',
}

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  padding: '0 48px',
}

const receiptSection = {
  backgroundColor: '#f4f4f4',
  borderRadius: '4px',
  margin: '24px 48px',
  padding: '24px',
}

const receiptRow = {
  margin: '8px 0',
  fontSize: '16px',
  color: '#333',
}

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 48px',
}

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  padding: '0 48px',
}

export default FeeReceiptEmail
