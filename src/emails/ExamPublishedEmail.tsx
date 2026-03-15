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

interface ExamPublishedEmailProps {
  parentName: string
  studentName: string
  schoolName: string
  examName: string
  portalUrl: string
}

export const ExamPublishedEmail = ({
  parentName,
  studentName,
  schoolName,
  examName,
  portalUrl,
}: ExamPublishedEmailProps) => {
  const previewText = `Results Published: ${examName} for ${studentName}`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Exam Results Available</Heading>
          <Text style={text}>Dear {parentName},</Text>
          <Text style={text}>
            The results for the <strong>{examName}</strong> are now available for <strong>{studentName}</strong> inside the {schoolName} Parent Portal.
          </Text>

          <Section style={buttonContainer}>
            <Link href={portalUrl} style={button}>
              View Report Card
            </Link>
          </Section>

          <Text style={footer}>
            If you have any trouble logging in, please refer to your welcome email or contact the school office.
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
  borderTop: '4px solid #3b82f6',
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

export default ExamPublishedEmail
