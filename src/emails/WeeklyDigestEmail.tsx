import * as React from 'react'
import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components'

export interface WeeklyDigestDefaulter {
  studentName: string
  className: string
  balance: number
}

export interface WeeklyDigestEmailProps {
  schoolName: string
  rangeLabel: string
  totalCollected: string
  attendancePct: number
  totalPendingFees: string
  activeStudents: number
  activeTeachers: number
  topDefaulters: WeeklyDigestDefaulter[]
}

export const WeeklyDigestEmail = ({
  schoolName,
  rangeLabel,
  totalCollected,
  attendancePct,
  totalPendingFees,
  activeStudents,
  activeTeachers,
  topDefaulters,
}: WeeklyDigestEmailProps) => {
  const previewText = `${schoolName} — weekly summary (${rangeLabel})`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Weekly Summary</Heading>
          <Text style={subtitle}>
            {schoolName} · {rangeLabel}
          </Text>

          <Section style={statsSection}>
            <Row>
              <Column style={statCell}>
                <Text style={statValue}>{totalCollected}</Text>
                <Text style={statLabel}>Fees collected</Text>
              </Column>
              <Column style={statCell}>
                <Text style={statValue}>{attendancePct}%</Text>
                <Text style={statLabel}>Avg. attendance</Text>
              </Column>
            </Row>
            <Row>
              <Column style={statCell}>
                <Text style={statValue}>{totalPendingFees}</Text>
                <Text style={statLabel}>Pending fees</Text>
              </Column>
              <Column style={statCell}>
                <Text style={statValue}>
                  {activeStudents} / {activeTeachers}
                </Text>
                <Text style={statLabel}>Students / Teachers</Text>
              </Column>
            </Row>
          </Section>

          <Hr style={hr} />

          <Heading as="h2" style={h2}>
            Top Fee Defaulters
          </Heading>
          {topDefaulters.length === 0 ? (
            <Text style={text}>🎉 No outstanding balances — everyone is paid up.</Text>
          ) : (
            <Section>
              {topDefaulters.map((d, i) => (
                <Row key={i} style={defaulterRow}>
                  <Column style={{ ...defaulterCell, width: '70%' }}>
                    <Text style={defaulterName}>
                      {d.studentName}
                      {d.className ? ` · ${d.className}` : ''}
                    </Text>
                  </Column>
                  <Column style={{ ...defaulterCell, width: '30%', textAlign: 'right' as const }}>
                    <Text style={defaulterAmount}>₹{d.balance.toLocaleString('en-IN')}</Text>
                  </Column>
                </Row>
              ))}
            </Section>
          )}

          <Hr style={hr} />
          <Text style={footer}>
            This is an automated weekly digest from EduNexus. Log in to your dashboard for the
            full breakdown.
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
  color: '#111',
  fontSize: '24px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  margin: '24px 0 4px',
}

const h2 = {
  color: '#111',
  fontSize: '18px',
  fontWeight: 'bold',
  padding: '0 48px',
  margin: '8px 0',
}

const subtitle = {
  color: '#6b7280',
  fontSize: '14px',
  textAlign: 'center' as const,
  margin: '0 0 16px',
}

const statsSection = {
  padding: '0 32px',
}

const statCell = {
  padding: '12px',
  textAlign: 'center' as const,
}

const statValue = {
  color: '#111',
  fontSize: '22px',
  fontWeight: 'bold',
  margin: '0',
}

const statLabel = {
  color: '#6b7280',
  fontSize: '12px',
  margin: '2px 0 0',
}

const text = {
  color: '#333',
  fontSize: '14px',
  lineHeight: '22px',
  padding: '0 48px',
}

const defaulterRow = {
  padding: '0 48px',
}

const defaulterCell = {
  verticalAlign: 'middle' as const,
}

const defaulterName = {
  color: '#333',
  fontSize: '14px',
  margin: '6px 0',
}

const defaulterAmount = {
  color: '#dc2626',
  fontSize: '14px',
  fontWeight: 'bold',
  margin: '6px 0',
}

const hr = {
  borderColor: '#e5e7eb',
  margin: '20px 48px',
}

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  marginTop: '12px',
  padding: '0 48px',
}

export default WeeklyDigestEmail
