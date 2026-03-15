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

interface InventoryReceiptEmailProps {
  customerName: string
  schoolName: string
  billNumber: string
  totalAmount: string
  paymentMode: string
  date: string
}

export const InventoryReceiptEmail = ({
  customerName,
  schoolName,
  billNumber,
  totalAmount,
  paymentMode,
  date,
}: InventoryReceiptEmailProps) => {
  const previewText = `Purchase Receipt: ${billNumber} from ${schoolName}`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Purchase Receipt</Heading>
          <Text style={text}>Hi {customerName},</Text>
          <Text style={text}>
            Thank you for your purchase at the <strong>{schoolName}</strong> store. Here are the details of your transaction:
          </Text>

          <Section style={receiptSection}>
            <Text style={receiptRow}>
              <strong>Bill No:</strong> {billNumber}
            </Text>
            <Text style={receiptRow}>
              <strong>Date:</strong> {date}
            </Text>
            <Text style={receiptRow}>
              <strong>Total Amount:</strong> {totalAmount}
            </Text>
            <Text style={receiptRow}>
              <strong>Payment Mode:</strong> {paymentMode}
            </Text>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            This is an automated receipt. If you have any questions regarding your items, please visit the {schoolName} store.
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
  borderTop: '4px solid #10b981', // green for POS
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

export default InventoryReceiptEmail
