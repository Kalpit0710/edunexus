import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface FeeReminderEmailProps {
  parentName: string
  studentName: string
  schoolName: string
  feeName: string
  amountDue: string
  dueDate: string
  paymentUrl?: string
}

export const FeeReminderEmail = ({
  parentName,
  studentName,
  schoolName,
  feeName,
  amountDue,
  dueDate,
  paymentUrl,
}: FeeReminderEmailProps) => {
  const previewText = `Reminder: Pending Fee for ${studentName}`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Fee Reminder</Heading>
          <Text style={text}>Dear {parentName},</Text>
          <Text style={text}>
            This is a gentle reminder that to clear the pending fee for <strong>{studentName}</strong> at <strong>{schoolName}</strong>.
          </Text>

          <Section style={detailsSection}>
            <Text style={detailRow}>
              <strong>Fee Name:</strong> {feeName}
            </Text>
            <Text style={detailRow}>
              <strong>Amount Due:</strong> <span style={{ color: '#e53e3e' }}>{amountDue}</span>
            </Text>
            <Text style={detailRow}>
              <strong>Due Date:</strong> {dueDate}
            </Text>
          </Section>

          {paymentUrl && (
            <Section style={buttonContainer}>
              <Link href={paymentUrl} style={button}>
                Pay Now
              </Link>
            </Section>
          )}

          <Text style={footer}>
            Please ignore this email if the payment has already been made. Thank you.
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

const detailsSection = {
  backgroundColor: '#fffcf5',
  border: '1px solid #ffedd5',
  borderRadius: '4px',
  margin: '24px 48px',
  padding: '24px',
}

const detailRow = {
  margin: '8px 0',
  fontSize: '16px',
  color: '#333',
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
}

const button = {
  backgroundColor: '#2563eb',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '16px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
}

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  marginTop: '48px',
  padding: '0 48px',
}

export default FeeReminderEmail
