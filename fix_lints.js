const fs = require('fs');

const filesToFix = [
  'src/app/(school-admin)/school-admin/attendance/actions.ts',
  'src/app/(school-admin)/school-admin/onboarding/actions.ts',
  'src/app/(school-admin)/school-admin/settings/actions.ts',
  'src/app/(school-admin)/school-admin/students/actions.ts',
  'src/app/(school-admin)/school-admin/teachers/actions.ts',
  'src/app/(school-admin)/school-admin/onboarding/page.tsx',
  'src/app/(auth)/login/page.tsx',
  'src/app/(auth)/reset-password/page.tsx',
  'src/app/(school-admin)/school-admin/attendance/class-view/page.tsx',
  'src/app/(school-admin)/school-admin/attendance/page.tsx',
  'src/app/(school-admin)/school-admin/fees/history/page.tsx',
  'src/app/(school-admin)/school-admin/fees/pending/page.tsx',
  'src/app/(school-admin)/school-admin/reports/actions.ts',
  'src/app/(school-admin)/school-admin/reports/page.tsx',
  'src/app/(school-admin)/school-admin/settings/components/academic-tab.tsx',
  'src/app/(school-admin)/school-admin/settings/components/classes-tab.tsx',
  'src/app/(school-admin)/school-admin/settings/components/grading-tab.tsx',
  'src/app/(school-admin)/school-admin/settings/page.tsx',
  'src/app/(school-admin)/school-admin/students/new/actions.ts',
  'src/app/(school-admin)/school-admin/students/page.tsx',
  'src/app/(school-admin)/school-admin/students/[id]/edit/page.tsx',
  'src/app/(school-admin)/school-admin/teachers/new/page.tsx',
];

for(const f of filesToFix) {
    if(fs.existsSync(f)) {
        let content = fs.readFileSync(f, 'utf8');
        // fix ts-ignore
        content = content.replace(/\/\/ @ts-ignore/g, '// @ts-expect-error');
        // fix Database import in login
        if (f.includes('login/page.tsx')) content = content.replace(/import type \{ Database \} from '[^']+';\n?/, '');
        // fix Badge import
        if (f.includes('attendance/page.tsx') || f.includes('history/page.tsx')) content = content.replace(/Badge,?\s*/g, '').replace(/,\s*Badge/g, '');
        // fix unescaped quotes
        if (f.includes('reset-password') || f.includes('onboarding/page') || f.includes('settings/page') || f.includes('academic-tab')) {
            content = content.replace(/don't/g, "don&apos;t");
            content = content.replace(/Don't/g, "Don&apos;t");
            content = content.replace(/can't/g, "can&apos;t");
            content = content.replace(/it's/g, "it&apos;s");
            content = content.replace(/It's/g, "It&apos;s");
            content = content.replace(/you're/g, "you&apos;re");
            content = content.replace(/We've/g, "We&apos;ve");
            content = content.replace(/won't/g, "won&apos;t");
            content = content.replace(/"Current"/g, "&quot;Current&quot;");
            content = content.replace(/"Yes, proceed"/g, "&quot;Yes, proceed&quot;");
            content = content.replace(/"I understand"/g, "&quot;I understand&quot;");
            content = content.replace(/>"/g, ">&quot;");
            content = content.replace(/"</g, "&quot;<");
        }
        // Specific fixes
        if (f.includes('class-view/page.tsx')) content = content.replace('getMonthlyAttendanceReport, ', '').replace(/,\s*getMonthlyAttendanceReport/g, '');
        if (f.includes('pending/page.tsx')) content = content.replace('CardDescription, ', '').replace(/,\s*CardDescription/g, '');
        if (f.includes('reports/actions.ts')) content = content.replace(/const studentCount = await [^\n]+/, '');
        if (f.includes('reports/page.tsx')) content = content.replace('TrendingUp, ', '').replace(/,\s*TrendingUp/g, '');
        if (f.includes('classes-tab.tsx')) content = content.replace('Label, ', '').replace(/,\s*Label/g, '');
        if (f.includes('grading-tab.tsx')) content = content.replace(/Card,\s*/g, '').replace(/CardContent,\s*/g, '').replace(/,\s*Card\b/g, '').replace(/,\s*CardContent/g, '');
        if (f.includes('settings/page.tsx')) content = content.replace('getSchoolSettings, ', '').replace(/,\s*getSchoolSettings/g, '');
        if (f.includes('students/new/actions.ts')) content = content.replace(/const \{ data, error \}/g, 'const { error }');
        if (f.includes('students/page.tsx')) content = content.replace('CardTitle, ', '').replace('CardDescription, ', '').replace(/,\s*CardTitle/g, '').replace(/,\s*CardDescription/g, '');
        if (f.includes('[id]/edit/page.tsx')) content = content.replace('CardDescription, ', '').replace('CardFooter, ', '').replace(/,\s*CardDescription/g, '').replace(/,\s*CardFooter/g, '');
        if (f.includes('teachers/new/page.tsx')) content = content.replace('useEffect, ', '').replace(/,\s*useEffect/g, '');
        
        fs.writeFileSync(f, content);
        console.log('Fixed', f);
    }
}
