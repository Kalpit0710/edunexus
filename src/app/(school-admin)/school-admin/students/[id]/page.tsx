'use client'

import { useState, useEffect } from 'react'
import * as React from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { getStudentById } from '../actions'
import { getClassesAndSections } from '../new/actions'
import { getStudentPaymentHistory, type FeePaymentRow } from '../../fees/actions'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, User, Phone, MapPin, Edit, Activity, Receipt, CalendarCheck } from 'lucide-react'
import Link from 'next/link'

export default function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const unwrappedParams = React.use(params)
    const id = unwrappedParams.id

    const { school } = useAuthStore()
    const [student, setStudent] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [className, setClassName] = useState('')
    const [sectionName, setSectionName] = useState('')
    const [payments, setPayments] = useState<FeePaymentRow[]>([])
    const [paymentsLoading, setPaymentsLoading] = useState(false)

    useEffect(() => {
        if (school?.id && id) loadData()
    }, [school?.id, id])

    async function loadData() {
        try {
            const data = await getStudentById(id)
            setStudent(data)
            if (data.class_id) {
                const clRes = await getClassesAndSections(school!.id)
                const cls = (clRes.classes as any[]).find(c => c.id === data.class_id)
                if (cls) setClassName(cls.name)
                if (data.section_id) {
                    const sec = (clRes.sections as any[]).find(s => s.id === data.section_id)
                    if (sec) setSectionName(sec.name)
                }
            }
            // Load fee history in background
            if (school?.id) {
                setPaymentsLoading(true)
                getStudentPaymentHistory(school.id, id)
                    .then(setPayments)
                    .catch(console.error)
                    .finally(() => setPaymentsLoading(false))
            }
        } catch (e: any) {
            toast.error('Failed to load profile: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="max-w-5xl mx-auto space-y-6">
                <Skeleton className="h-10 w-64" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-64 rounded-xl" />
                    <div className="md:col-span-2 space-y-4">
                        <Skeleton className="h-48 rounded-xl" />
                        <Skeleton className="h-32 rounded-xl" />
                    </div>
                </div>
            </div>
        )
    }

    if (!student) return <div className="p-8 text-destructive">Student not found</div>

    const totalPaid = payments.reduce((s, p) => s + Number(p.paid_amount), 0)

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href={'/school-admin/students' as any}>
                        <Button variant="outline" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
                    </Link>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Student Profile</h2>
                        <p className="text-muted-foreground text-sm">Detailed overview of student records</p>
                    </div>
                </div>
                <Link href={`/school-admin/students/${student.id}/edit` as any}>
                    <Button variant="outline" className="gap-2"><Edit className="w-4 h-4" /> Edit Profile</Button>
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Identity Card */}
                <div className="md:col-span-1 space-y-4">
                    <Card>
                        <CardContent className="pt-6 flex flex-col items-center text-center">
                            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                                <User className="w-10 h-10 text-primary" />
                            </div>
                            <h3 className="text-lg font-bold">{student.full_name}</h3>
                            <p className="text-muted-foreground text-sm mt-1">
                                {className}{sectionName ? ` - ${sectionName}` : ''}
                            </p>
                            <Badge className="mt-3" variant={student.status === 'active' || !student.status ? 'default' : 'secondary'}>
                                {student.status === 'active' || !student.status ? 'Active' : student.status}
                            </Badge>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Quick Facts</CardTitle></CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            {[
                                { label: 'Admission No', value: student.admission_number },
                                { label: 'Roll No', value: student.roll_number },
                                { label: 'Gender', value: student.gender },
                                { label: 'Date of Birth', value: student.date_of_birth },
                                { label: 'Joined', value: student.date_of_joining },
                            ].map(({ label, value }) => (
                                <div key={label} className="flex justify-between gap-2">
                                    <span className="text-muted-foreground">{label}</span>
                                    <span className="font-medium capitalize">{value || 'N/A'}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                {/* Tabbed Detail Panel */}
                <div className="md:col-span-2">
                    <Tabs defaultValue="profile" className="space-y-4">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="profile" className="gap-1.5">
                                <User className="h-3.5 w-3.5" /> Profile
                            </TabsTrigger>
                            <TabsTrigger value="fees" className="gap-1.5">
                                <Receipt className="h-3.5 w-3.5" /> Fee History
                            </TabsTrigger>
                            <TabsTrigger value="attendance" className="gap-1.5">
                                <CalendarCheck className="h-3.5 w-3.5" /> Attendance
                            </TabsTrigger>
                        </TabsList>

                        {/* Profile Tab */}
                        <TabsContent value="profile" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Phone className="w-4 h-4" /> Parent & Contact Info
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-muted-foreground mb-1">Parent/Guardian Name</p>
                                            <p className="font-medium">{student.parent_name || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground mb-1">Contact Number</p>
                                            <p className="font-medium">{student.parent_contact || 'N/A'}</p>
                                        </div>
                                        <div className="col-span-2 md:col-span-1">
                                            <p className="text-muted-foreground mb-1">Email Address</p>
                                            <p className="font-medium">{student.parent_email || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <div className="pt-3 border-t text-sm">
                                        <p className="text-muted-foreground mb-1 flex items-center gap-1"><MapPin className="w-4 h-4" /> Address</p>
                                        <p className="font-medium">{student.address || 'N/A'}</p>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Activity className="w-4 h-4" /> Health & Medical
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-muted-foreground mb-1">Blood Group</p>
                                            <p className="font-bold text-red-500">{student.blood_group || 'Unknown'}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-muted-foreground mb-1">Medical Conditions & Notes</p>
                                            <p className="font-medium p-3 bg-muted rounded-md text-sm">
                                                {student.medical_conditions || 'None specified.'}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Fee History Tab */}
                        <TabsContent value="fees">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <CardTitle className="text-base">Fee Payment History</CardTitle>
                                    <div className="text-sm text-emerald-600 font-semibold">
                                        Total Paid: ₹{totalPaid.toLocaleString('en-IN')}
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {paymentsLoading ? (
                                        <div className="p-4 space-y-3">
                                            {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                                        </div>
                                    ) : payments.length === 0 ? (
                                        <div className="py-10 text-center text-muted-foreground text-sm">
                                            No fee payments recorded yet.
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                                                    <tr>
                                                        <th className="px-4 py-2 text-left">Receipt</th>
                                                        <th className="px-4 py-2 text-left">Date</th>
                                                        <th className="px-4 py-2 text-right">Amount</th>
                                                        <th className="px-4 py-2 text-left">Mode</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {payments.map(p => (
                                                        <tr key={p.id} className="hover:bg-muted/30">
                                                            <td className="px-4 py-2 font-mono text-xs">{p.receipt_number}</td>
                                                            <td className="px-4 py-2 text-muted-foreground">
                                                                {new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                            </td>
                                                            <td className="px-4 py-2 text-right font-semibold text-emerald-600">
                                                                ₹{Number(p.paid_amount).toLocaleString('en-IN')}
                                                            </td>
                                                            <td className="px-4 py-2 capitalize text-muted-foreground">{p.payment_mode}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Attendance Tab */}
                        <TabsContent value="attendance">
                            <Card>
                                <CardContent className="py-10 text-center text-muted-foreground text-sm">
                                    <CalendarCheck className="h-10 w-10 mx-auto mb-3 opacity-40" />
                                    <p>View detailed attendance in the <strong>Attendance</strong> module.</p>
                                    <Link href={'/school-admin/attendance' as any} className="mt-3 inline-block">
                                        <Button size="sm" variant="outline" className="mt-3 gap-2">
                                            <CalendarCheck className="h-4 w-4" /> Go to Attendance
                                        </Button>
                                    </Link>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    )
}
