import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'EduNexus — School Management System'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #020817 0%, #0f172a 50%, #1e3a5f 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: 'absolute',
            top: -100,
            left: -100,
            width: 600,
            height: 600,
            borderRadius: '50%',
            background: 'rgba(59, 130, 246, 0.15)',
            filter: 'blur(80px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -100,
            right: -100,
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: 'rgba(99, 102, 241, 0.15)',
            filter: 'blur(80px)',
          }}
        />

        {/* Logo area */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 20,
              fontSize: 36,
            }}
          >
            🎓
          </div>
          <span
            style={{
              fontSize: 52,
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-1px',
            }}
          >
            EduNexus
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 26,
            color: '#94a3b8',
            textAlign: 'center',
            maxWidth: 700,
            lineHeight: 1.4,
          }}
        >
          The modern, all-in-one school management platform
        </div>

        {/* Feature pills */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            marginTop: 40,
            flexWrap: 'wrap',
            justifyContent: 'center',
            maxWidth: 900,
          }}
        >
          {['Students', 'Teachers', 'Fees', 'Attendance', 'Exams', 'Reports'].map((label) => (
            <div
              key={label}
              style={{
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: 999,
                padding: '8px 20px',
                color: '#93c5fd',
                fontSize: 18,
                fontWeight: 500,
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* URL badge */}
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            color: '#475569',
            fontSize: 16,
          }}
        >
          edunexus.app
        </div>
      </div>
    ),
    { ...size },
  )
}
