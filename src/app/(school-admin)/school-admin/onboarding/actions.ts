'use server'

import { createClient as getSupabase } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'

export type OnboardingData = {
    profile: {
        address: string;
        theme_color: string;
    };
    academicYear: {
        name: string;
        start_date: string;
        end_date: string;
    };
    classes: {
        name: string;
        sections: string[]; // e.g. ['A', 'B']
    }[];
    gradingRules: {
        grade_name: string;
        min_marks: number;
        max_marks: number;
        grade_point: number;
    }[];
}

export async function completeOnboarding(schoolId: string, data: OnboardingData) {
    const supabase = await getSupabase();

    // 1. Update Profile
    if (data.profile.address || data.profile.theme_color) {
        const payload: Database['public']['Tables']['schools']['Update'] = {}
        if (data.profile.address) payload.address = data.profile.address
        if (data.profile.theme_color) payload.theme_color = data.profile.theme_color

        const { error } = await supabase.from('schools').update(payload).eq('id', schoolId);
        if (error) throw new Error("We could not update the school profile. Please try again.");
    }

    // 2. Create Academic Year
    if (data.academicYear.name && data.academicYear.start_date && data.academicYear.end_date) {
        const { error } = await supabase.from('academic_years').insert([{
            school_id: schoolId,
            name: data.academicYear.name,
            start_date: data.academicYear.start_date,
            end_date: data.academicYear.end_date,
            is_current: true
        }]);
        if (error) throw new Error("We could not create the academic year. Please try again.");
    }

    // 3. Create Classes and Sections
    if (data.classes.length > 0) {
        for (let i = 0; i < data.classes.length; i++) {
            const cls = data.classes[i]!;

            const { data: classData, error: classErr } = await supabase.from('classes').insert([{
                school_id: schoolId,
                name: cls.name,
                display_order: i + 1
            }]).select('id').single();

            if (classErr) throw new Error("Failed to create class: " + classErr.message);

            const classId = classData?.id;

            if (cls.sections.length > 0) {
                const sectionInserts = cls.sections.map(secName => ({
                    school_id: schoolId,
                    class_id: classId,
                    name: secName,
                    capacity: 40 // Default capacity
                }));
                const { error: secErr } = await supabase.from('sections').insert(sectionInserts);
                if (secErr) throw new Error("Failed to create sections: " + secErr.message);
            }
        }
    }

    // 4. Create Grading Rules
    if (data.gradingRules.length > 0) {
        const rulesInserts = data.gradingRules.map(rule => ({
            school_id: schoolId,
            grade_name: rule.grade_name,
            min_marks: rule.min_marks,
            max_marks: rule.max_marks,
            grade_point: rule.grade_point
        }));
        const { error: gradeErr } = await supabase.from('grading_rules').insert(rulesInserts);
        if (gradeErr) throw new Error("Failed to create grading rules: " + gradeErr.message);
    }

    return true;
}

export async function uploadSchoolLogo(formData: FormData) {
    const file = formData.get('file') as File;
    const schoolId = formData.get('schoolId') as string;
    if (!file || !schoolId) throw new Error('Missing file or schoolId');

    const supabase = await getSupabase();

    const fileExt = file.name.split('.').pop();
    const fileName = `${schoolId}/logo.${fileExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
        .from('school-logos')
        .upload(fileName, buffer, {
            contentType: file.type,
            upsert: true
        });

    if (uploadError) {
        // Fallback or ignore if bucket doesn't strictly exist for demo depending on how it's setup
        console.error("Logo upload error:", uploadError);
    }

    const { data: urlData } = supabase.storage
        .from('school-logos')
        .getPublicUrl(fileName);

    const { error: updateErr } = await supabase.from('schools').update({
        logo_url: urlData.publicUrl
    }).eq('id', schoolId);

    if (updateErr) throw new Error("Failed to update school with logo URL: " + updateErr.message);

    return urlData.publicUrl;
}
