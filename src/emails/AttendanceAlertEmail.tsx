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
} from '@react-email/components'

interface AttendanceAlertEmailProps {
  parentName: string
  studentName: string
  schoolName: string
  date: string
}

export const AttendanceAlertEmail = ({
  parentName,
  studentName,
  schoolName,
  date,
}: AttendanceAlertEmailProps) => {
  const previewText = `Attendance Alert: ${studentName} was marked absent today.`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Attendance Alert</Heading>
          <Text style={text}>Dear {parentName},</Text>
          <Text style={text}>
            We wanted to inform you that <strong>{studentName}</strong> has been marked as <strong>absent</strong> for {date} at {schoolName}.
          </Text>

          <Section style={infoSection}>
            <Text style={infoText}>
              If this was expected or if there is a medical reason, please contact the school office to excuse the absence.
            </Text>
          </Section>

          <Text style={footer}>
            Student safety and attendance are our top priorities. Thank you for your cooperation!
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
  borderTop: '4px solid #e53e3e',
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

const infoSection = {
  backgroundColor: '#fff5f5',
  borderRadius: '4px',
  margin: '24px 48px',
  padding: '16px',
  textAlign: 'center' as const,
}

const infoText = {
  margin: '0',
  fontSize: '14px',
  color: '#e53e3e',
}

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  marginTop: '48px',
  padding: '0 48px',
}

export default AttendanceAlertEmail
