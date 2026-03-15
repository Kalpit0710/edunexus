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

interface WelcomeEmailProps {
  name: string
  role: string
  schoolName: string
  loginUrl: string
  temporaryPassword?: string
}

export const WelcomeEmail = ({
  name,
  role,
  schoolName,
  loginUrl,
  temporaryPassword,
}: WelcomeEmailProps) => {
  const previewText = `Welcome to EduNexus, ${name}!`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Welcome to EduNexus</Heading>
          <Text style={text}>Hi {name},</Text>
          <Text style={text}>
            You have been added to <strong>{schoolName}</strong> as a <strong>{role}</strong>.
          </Text>

          {temporaryPassword && (
            <Section style={passwordSection}>
              <Text style={text}>Your temporary password is:</Text>
              <Text style={password}>{temporaryPassword}</Text>
              <Text style={text}>Please log in and change your password immediately.</Text>
            </Section>
          )}

          <Section style={buttonContainer}>
            <Link href={loginUrl} style={button}>
              Log In to EduNexus
            </Link>
          </Section>

          <Text style={footer}>
            If you have any questions, please contact your school administrator.
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

const passwordSection = {
  backgroundColor: '#f4f4f4',
  borderRadius: '4px',
  margin: '24px 48px',
  padding: '16px 0',
  textAlign: 'center' as const,
}

const password = {
  color: '#000',
  fontSize: '20px',
  fontWeight: 'bold',
  letterSpacing: '2px',
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

export default WelcomeEmail
