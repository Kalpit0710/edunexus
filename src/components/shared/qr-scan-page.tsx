'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import jsQR from 'jsqr'
import { markStudentAttendanceFromQr, resolveQrInfo, type ScannedInfo } from '@/app/(school-admin)/school-admin/id-cards/actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Camera, CameraOff, QrCode, UserCheck, UserRoundSearch } from 'lucide-react'

type ScanMode = 'info' | 'attendance'

interface QrScanPageProps {
  portalLabel: string
}

interface VideoInputDevice {
  id: string
  label: string
}

function toDateInputValue(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function QrScanPage({ portalLabel }: QrScanPageProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<ScanMode>('info')
  const [date, setDate] = useState(toDateInputValue())
  const [loading, setLoading] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [cameraDevices, setCameraDevices] = useState<VideoInputDevice[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string>('')
  const [dragActive, setDragActive] = useState(false)
  const [result, setResult] = useState<ScannedInfo | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastScanAtRef = useRef<number>(0)
  const lastResolvedQrRef = useRef<string>('')

  const canUseCamera = useMemo(
    () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
    []
  )
  const busy = loading || uploadingImage
  const pickStudentMode = searchParams.get('pick') === 'student'
  const returnTo = searchParams.get('returnTo')?.trim() ?? ''

  const buildReturnUrl = useCallback(
    (studentId: string): string => {
      if (!returnTo.startsWith('/')) {
        throw new Error('Invalid return path for QR student selection.')
      }

      const separator = returnTo.includes('?') ? '&' : '?'
      return `${returnTo}${separator}studentId=${encodeURIComponent(studentId)}`
    },
    [returnTo],
  )

  const ensureCanvas = useCallback((): HTMLCanvasElement => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas')
    }
    return canvasRef.current
  }, [])

  const refreshCameraDevices = useCallback(async () => {
    if (!canUseCamera || typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return
    }

    const devices = await navigator.mediaDevices.enumerateDevices()
    const inputs = devices
      .filter((device) => device.kind === 'videoinput')
      .map((device, idx) => ({
        id: device.deviceId,
        label: device.label || `Camera ${idx + 1}`,
      }))

    setCameraDevices(inputs)
    setSelectedCameraId((prev) => prev || inputs[0]?.id || '')
  }, [canUseCamera])

  const decodeQrFromSource = useCallback(
    (source: CanvasImageSource, width: number, height: number): string | null => {
      const canvas = ensureCanvas()
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) return null

      context.drawImage(source, 0, 0, width, height)
      const imageData = context.getImageData(0, 0, width, height)
      const decoded = jsQR(imageData.data, width, height, { inversionAttempts: 'attemptBoth' })
      return decoded?.data?.trim() || null
    },
    [ensureCanvas],
  )

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    const stream = streamRef.current
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    streamRef.current = null
    setCameraActive(false)
  }, [])

  const processQr = useCallback(
    async (rawText: string) => {
      const normalized = rawText.trim()
      if (!normalized) return

      // Avoid repeatedly processing the same token from rapid frame loops.
      if (normalized === lastResolvedQrRef.current && !pickStudentMode) return

      setLoading(true)
      setError(null)
      setMessage(null)

      try {
        const info = await resolveQrInfo(normalized)
        setResult(info)
        lastResolvedQrRef.current = normalized

        if (pickStudentMode) {
          if (info.entity !== 'student') {
            throw new Error('This QR is not a student card. Please scan a student ID card.')
          }

          if (!returnTo) {
            throw new Error('Missing return path for student selection mode.')
          }

          setMessage(`Student selected: ${info.fullName}. Redirecting...`)
          router.push(buildReturnUrl(info.id) as never)
          return
        }

        if (mode === 'attendance') {
          const markResult = await markStudentAttendanceFromQr(normalized, date)
          if (markResult.marked) {
            setMessage(`Attendance marked as present for ${date}.`)
          }
        } else {
          setMessage('Student/teacher information loaded successfully.')
        }
      } catch (e) {
        setResult(null)
        lastResolvedQrRef.current = ''
        setError(e instanceof Error ? e.message : 'Failed to process QR code.')
      } finally {
        setLoading(false)
      }
    },
    [buildReturnUrl, date, mode, pickStudentMode, returnTo, router]
  )

  const scanFrame = useCallback(async () => {
    if (!cameraActive || !videoRef.current || busy) {
      rafRef.current = requestAnimationFrame(() => {
        void scanFrame()
      })
      return
    }

    if (videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
      rafRef.current = requestAnimationFrame(() => {
        void scanFrame()
      })
      return
    }

    const now = Date.now()
    if (now - lastScanAtRef.current < 800) {
      rafRef.current = requestAnimationFrame(() => {
        void scanFrame()
      })
      return
    }

    try {
      const raw = decodeQrFromSource(videoRef.current, videoRef.current.videoWidth, videoRef.current.videoHeight)
      if (raw) {
        lastScanAtRef.current = now
        await processQr(raw)
      }
    } catch {
      // Ignore transient detection failures while streaming frames.
    }

    rafRef.current = requestAnimationFrame(() => {
      void scanFrame()
    })
  }, [busy, cameraActive, decodeQrFromSource, processQr])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    setError(null)
    setMessage(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: selectedCameraId
          ? { deviceId: { exact: selectedCameraId } }
          : { facingMode: { ideal: 'environment' } },
        audio: false,
      })

      if (!videoRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setCameraActive(true)
      void refreshCameraDevices()
      rafRef.current = requestAnimationFrame(() => {
        void scanFrame()
      })
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'Unknown camera error.'
      setCameraError(`Unable to access camera. Check permissions/camera availability. (${reason})`)
      stopCamera()
    }
  }, [refreshCameraDevices, scanFrame, selectedCameraId, stopCamera])

  const decodeQrFromFile = useCallback(
    async (file: File): Promise<string | null> => {
      const objectUrl = URL.createObjectURL(file)
      try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.onerror = () => reject(new Error('Unable to load image.'))
          img.src = objectUrl
        })

        const width = image.naturalWidth || image.width
        const height = image.naturalHeight || image.height
        if (width <= 0 || height <= 0) return null

        return decodeQrFromSource(image, width, height)
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    },
    [decodeQrFromSource],
  )

  const handleImageUpload = useCallback(
    async (file: File | null) => {
      if (!file) return

      setUploadingImage(true)
      setError(null)
      setMessage(null)

      try {
        const raw = await decodeQrFromFile(file)

        if (!raw) {
          throw new Error('No readable QR code found in this image. Try a clearer image.')
        }

        await processQr(raw)
      } catch (e) {
        setResult(null)
        setError(e instanceof Error ? e.message : 'Failed to read QR from image upload.')
      } finally {
        setUploadingImage(false)
      }
    },
    [decodeQrFromFile, processQr],
  )

  const clearResult = useCallback(() => {
    setResult(null)
    setError(null)
    setMessage(null)
    lastResolvedQrRef.current = ''
  }, [])

  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  useEffect(() => {
    if (!canUseCamera) return
    void refreshCameraDevices()

    const onDeviceChange = () => {
      void refreshCameraDevices()
    }

    navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange)
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', onDeviceChange)
  }, [canUseCamera, refreshCameraDevices])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopCamera()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [stopCamera])

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const item = event.clipboardData?.items?.[0]
      if (!item || !item.type.startsWith('image/')) return
      const file = item.getAsFile()
      if (!file) return
      event.preventDefault()
      void handleImageUpload(file)
    }

    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [handleImageUpload])

  const canOpenStudentProfile =
    !!result && result.entity === 'student' && (pathname.startsWith('/school-admin') || pathname.startsWith('/manager'))

  const openStudentProfile = useCallback(() => {
    if (!result || result.entity !== 'student') return
    router.push(`/school-admin/students/${result.id}` as never)
  }, [result, router])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">QR Scan</h1>
        <p className="text-sm text-muted-foreground">
          {pickStudentMode
            ? `${portalLabel}: scan a student QR to auto-select them in the previous form.`
            : `${portalLabel}: scan an EduNexus ID card QR for info lookup or instant attendance marking.`}
        </p>
      </div>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Scanner Input
            </CardTitle>
            <CardDescription>
              Scan with camera or upload a QR image. We only show verified student/teacher details after server validation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!pickStudentMode ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={mode === 'info' ? 'default' : 'outline'}
                  onClick={() => setMode('info')}
                  className="gap-2"
                >
                  <UserRoundSearch className="h-4 w-4" />
                  Info Only
                </Button>
                <Button
                  type="button"
                  variant={mode === 'attendance' ? 'default' : 'outline'}
                  onClick={() => setMode('attendance')}
                  className="gap-2"
                >
                  <UserCheck className="h-4 w-4" />
                  Mark Attendance
                </Button>
              </div>
            ) : null}

            <div className="space-y-3 rounded-2xl border border-slate-200/70 bg-gradient-to-b from-slate-50 to-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={cameraActive ? 'destructive' : 'outline'}
                  onClick={cameraActive ? stopCamera : startCamera}
                  disabled={!canUseCamera}
                  className="gap-2"
                >
                  {cameraActive ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                  {cameraActive ? 'Stop Camera' : 'Start Camera Scan'}
                </Button>
                <p className="text-xs text-slate-600">
                  Point the camera at an EduNexus ID card. Verified details appear automatically.
                </p>
              </div>

              {cameraDevices.length > 1 ? (
                <div className="max-w-sm space-y-1">
                  <Label htmlFor="qr-camera-device" className="text-xs text-slate-700">Camera Device</Label>
                  <select
                    id="qr-camera-device"
                    value={selectedCameraId}
                    onChange={(e) => setSelectedCameraId(e.target.value)}
                    className="flex h-9 w-full items-center rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700"
                    disabled={cameraActive}
                  >
                    {cameraDevices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="relative overflow-hidden rounded-xl border border-slate-300 bg-slate-900">
                <video ref={videoRef} className="h-72 w-full object-cover" muted playsInline autoPlay />
                {!cameraActive ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-900/35 text-xs font-medium text-white/80">
                    Camera preview
                  </div>
                ) : null}
              </div>

              {cameraError ? <p className="text-sm text-amber-700">{cameraError}</p> : null}
            </div>

            <div
              className={`space-y-2 rounded-xl border-2 border-dashed p-3 transition ${dragActive ? 'border-blue-400 bg-blue-50/70' : 'border-slate-300/70'}`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragActive(false)
                const file = e.dataTransfer.files?.[0]
                void handleImageUpload(file ?? null)
              }}
            >
              <Label htmlFor="qr-image-upload">Upload QR Image</Label>
              <Input
                id="qr-image-upload"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => void handleImageUpload(e.target.files?.[0] ?? null)}
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">
                Upload or drag-drop a QR image. You can also paste an image from clipboard.
              </p>
            </div>

            {mode === 'attendance' && !pickStudentMode ? (
              <div className="max-w-xs space-y-2">
                <Label htmlFor="attendance-date">Attendance Date</Label>
                <Input id="attendance-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" type="button" onClick={clearResult} disabled={busy && !result}>
                Clear Result
              </Button>
            </div>

            {message ? <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">{message}</p> : null}
            {error ? <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scan Result</CardTitle>
            <CardDescription>
              {canOpenStudentProfile
                ? 'Verified details. Click the card to open the student profile.'
                : 'Verified profile details from QR payload.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result ? (
              <div
                role={canOpenStudentProfile ? 'button' : undefined}
                tabIndex={canOpenStudentProfile ? 0 : -1}
                onClick={canOpenStudentProfile ? openStudentProfile : undefined}
                onKeyDown={canOpenStudentProfile ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openStudentProfile()
                  }
                } : undefined}
                className={`flex flex-wrap items-start gap-4 rounded-2xl border p-4 transition ${canOpenStudentProfile ? 'cursor-pointer border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/50' : 'border-slate-200/70'}`}
              >
                <div className="h-20 w-20 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                  {result.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={result.photoUrl} alt={result.fullName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-slate-500">
                      {result.fullName.trim().slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{result.fullName}</h2>
                    <Badge variant="secondary">{result.entity.toUpperCase()}</Badge>
                  </div>
                  {result.entity === 'student' ? (
                    <div className="space-y-1 text-sm text-slate-600">
                      <p>Admission No: {result.admissionNumber}</p>
                      <p>Class: {result.className ?? '—'}</p>
                      <p>Section: {result.sectionName ?? '—'}</p>
                    </div>
                  ) : (
                    <div className="space-y-1 text-sm text-slate-600">
                      <p>Employee ID: {result.employeeId ?? '—'}</p>
                    </div>
                  )}
                  {canOpenStudentProfile ? (
                    <p className="text-xs font-medium text-blue-600">Open full student profile</p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300/70 p-6 text-sm text-muted-foreground">
                Scan or upload a QR to view the verified profile details here.
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
