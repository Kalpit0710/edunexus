'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { getStudentById } from '../actions'
import { getClassesAndSections } from '../new/actions'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeft, User, Phone, MapPin, Edit, Activity } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

export default function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const unwrappedParams = React.use(params)
    const id = unwrappedParams.id

    const { school } = useAuthStore()
    const [student, setStudent] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    const [className, setClassName] = useState('')
    const [sectionName, setSectionName] = useState('')

    useEffect(() => {
        if (school?.id && id) {
            loadData()
        }
    }, [school?.id, id])

    async function loadData() {
        try {
            const data = await getStudentById(id)
            setStudent(data)

            // Fetch classes to map the name loosely
            if (data.class_id) {
                const clRes = await getClassesAndSections(school!.id)
                const classesList = (clRes.classes || []) as any[]
                const cMatch = classesList.find(c => c.id === data.class_id)
                if (cMatch) setClassName(cMatch.name)

                if (data.section_id) {
                    const sectionsList = (clRes.sections || []) as any[]
                    const sMatch = sectionsList.find(s => s.id === data.section_id)
                    if (sMatch) setSectionName(sMatch.name)
                }
            }

        } catch (e: any) {
            toast.error('Failed to load profile: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    if (loading) return <div className="p-8">Loading profile...</div>
    if (!student) return <div className="p-8 text-red-500">Student not found</div>

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href={"/school-admin/students" as any}>
                        <Button variant="outline" size="icon">
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    </Link>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Student Profile</h2>
                        <p className="text-muted-foreground">Detailed overview of student records.</p>
                    </div>
                </div>
                <Link href={`/school-admin/students/${student.id}/edit` as any}>
                    <Button variant="outline">
                        <Edit className="w-4 h-4 mr-2" /> Edit Profile
                    </Button>
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Left Col: Identity Card */}
                <div className="md:col-span-1 space-y-6">
                    <Card>
                        <CardContent className="pt-6 flex flex-col items-center text-center">
                            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
                                <User className="w-12 h-12 text-muted-foreground" />
                            </div>
                            <h3 className="text-xl font-bold">{student.full_name}</h3>
                            <p className="text-muted-foreground text-sm uppercase tracking-wider">{className} {sectionName ? `- ${sectionName}` : ''}</p>
                            <div className="mt-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                                {student.status === 'active' ? 'Active' : student.status}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Quick Facts</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Admission No:</span>
                                <span className="font-medium">{student.admission_number || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Roll No:</span>
                                <span className="font-medium">{student.roll_number || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Gender:</span>
                                <span className="font-medium capitalize">{student.gender || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Date of Birth:</span>
                                <span className="font-medium">{student.date_of_birth || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Joining Date:</span>
                                <span className="font-medium">{student.date_of_joining || 'N/A'}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Col: Details Tabs */}
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2"><Phone className="w-4 h-4" /> Parent & Contact Info</CardTitle>
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
                            <div className="pt-4 border-t text-sm">
                                <p className="text-muted-foreground mb-1 flex items-center gap-1"><MapPin className="w-4 h-4" /> Address</p>
                                <p className="font-medium">{student.address || 'N/A'}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2"><Activity className="w-4 h-4" /> Health & Medical</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground mb-1">Blood Group</p>
                                    <p className="font-medium font-bold text-red-500">{student.blood_group || 'Unknown'}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-muted-foreground mb-1">Medical Conditions & Notes</p>
                                    <p className="font-medium p-3 bg-muted rounded-md">{student.medical_conditions || 'None specified.'}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

            </div>
        </div>
    )
}
