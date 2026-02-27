# EduNexus — UI/UX Guidelines

> **Version:** 1.0.0  
> **Last Updated:** 2026-02-27

---

## Design Principles

| Principle | Meaning |
|-----------|---------|
| **Non-Tech Friendly** | A 50-year-old principal or a cashier with no computer background must use it without training |
| **Minimal Cognitive Load** | Show only what the user needs for their current task |
| **Guided Flows** | Multi-step wizards over long forms |
| **Forgiving** | Confirmations before destructive actions; undo where possible |
| **Consistent** | Same patterns for same actions across all modules |
| **Responsive** | Fully functional on tablet and mobile |
| **Dynamic & Engaging** | Smooth micro-interactions and animations to guide the user visually |
| **Modern & Soft Aesthetics** | Glassmorphism, soft shadows, rounded borders, and clean UI for a premium feel |

---

## Tech Stack

| Tool | Role |
|------|------|
| Tailwind CSS | Utility-first styling |
| shadcn/ui | Accessible component primitives (with enhanced soft styling) |
| Framer Motion | Page transitions and complex micro-animations |
| Lucide React | Icon library |
| Recharts | Charts and analytics |
| React Hook Form | Form management |
| React Hot Toast | Notifications/toasts |
| date-fns | Date formatting |

---

## Color System

```css
/* Theme tokens in tailwind.config.ts - Soft & Modern */
:root {
  --background:     0 0% 98%;         /* Soft off-white */
  --foreground:     222.2 84% 4.9%;   /* Near-black */
  --card:           0 0% 100%;
  --primary:        221 83% 53%;      /* Blue (default; overridden per school) */
  --primary-foreground: 210 40% 98%;
  --secondary:      210 40% 96.1%;
  --muted:          210 40% 96.1%;
  --accent:         210 40% 96.1%;
  --destructive:    0 84.2% 60.2%;   /* Red — for delete/warning */
  --border:         214.3 31.8% 91.4%;
  --radius:         1rem;             /* Soft, larger border radius */
  --shadow-soft:    0 8px 30px rgba(0,0,0,0.04); /* Premium soft shadow */
}

/* Dark mode overrides mapped for glassmorphism and subtle gradients */
.dark {
  --background:     222.2 84% 4.9%;
  --card:           222.2 84% 6.9%;
  ...
}
```

### School Theme Override
Each school has a `theme_color` (hex). This replaces `--primary` at login:

```typescript
// Apply school theme after login
document.documentElement.style.setProperty('--primary', school.theme_hsl)
```

### Semantic Color Usage

| Color | Use |
|-------|-----|
| Blue (primary) | Primary actions, active states |
| Green | Success, paid status, present |
| Red (destructive) | Delete, error, absent, overdue |
| Yellow/Amber | Warning, pending, late |
| Gray (muted) | Secondary text, borders, disabled |

---

## Typography

```css
/* Scale (Tailwind classes) */
heading-1: text-3xl font-bold tracking-tight    /* Page titles */
heading-2: text-2xl font-semibold tracking-tight /* Section headers */
heading-3: text-xl font-medium tracking-tight /* Card titles */
body:       text-sm text-foreground/90         /* Default body text */
small:      text-xs text-muted-foreground      /* Labels, hints */
```

**Font:** Google Fonts `Inter`, `Outfit`, or `Poppins` should be used as the primary font to provide a sleek, premium, modern app feel. Include a fallback to system fonts.

---

## Component Library

### Core Components (from shadcn/ui — DO NOT customize internals)

```
Button       Input        Select
Card         Table        Dialog (Modal)
Badge        Tabs         Sheet (Drawer)
Avatar       Calendar     DatePicker
Dropdown     Checkbox     RadioGroup
Pagination   Skeleton     Separator
Progress     Alert        Tooltip
```

### Custom Shared Components

```
DataTable          ← Sortable, filterable, paginated table used everywhere
ExcelUpload        ← Drag-drop Excel upload with preview
ConfirmModal       ← "Are you sure?" modal for destructive actions
PageHeader         ← Title + action buttons + breadcrumbs
StatusBadge        ← Color-coded status pill (paid/pending/overdue)
LoadingSkeleton    ← Content placeholder during data fetch
EmptyState         ← "No data found" with action button
SearchInput        ← Debounced search with clear button
RoleGate           ← Show/hide content based on user role
```

---

## Layout System

### Authenticated Pages

```
┌──────────────────────────────────────────┐
│  Top Navbar (64px height)                │
│  [School Logo] [School Name]  [Bell] [User] │
└──────────────────────────────────────────┘
│  ┌────────────┐  ┌─────────────────────┐ │
│  │  Sidebar   │  │   Main Content      │ │
│  │  (240px)   │  │   (flex-1)          │ │
│  │            │  │                     │ │
│  │  Module    │  │   PageHeader        │ │
│  │  Links     │  │   ─────────────     │ │
│  │            │  │   Page content      │ │
│  └────────────┘  └─────────────────────┘ │
```

On mobile: Sidebar collapses to hamburger menu (Sheet/Drawer)

### Page Structure

// Standard page layout with Framer Motion transitions
import { motion } from 'framer-motion'

export default function StudentsPage() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex flex-col gap-6 p-6"
    >
      <PageHeader
        title="Students"
        description="Manage all students in your school"
        actions={<Button className="shadow-soft hover:scale-105 transition-transform"><Plus /> Add Student</Button>}
      />
      <Card className="shadow-soft border-border/50">
        <CardContent>
          <DataTable ... />
        </CardContent>
      </Card>
    </motion.div>
  )
}
```

### Interactive States & Animations
- **Hover Effects:** Use smooth scaling (`hover:scale-[1.02]`) and color shifts for interactive cards.
- **Page Transitions:** Wrap main content views in `AnimatePresence` and fade/slide smoothly.
- **Sidebar:** Sidebar toggles should use smooth spring animations for a fluid feel.

---

## Navigation Structure

### School Admin Sidebar

```
📊 Dashboard
─────────────
👨‍🎓 Students
👩‍🏫 Teachers
🏫 Classes & Sections
─────────────
📅 Attendance
📘 Exams & Results
─────────────
💰 Fee Management
🛍 Inventory & POS
─────────────
📢 Announcements
📈 Reports
─────────────
⚙️  Settings
```

### Teacher Sidebar
```
📊 Dashboard
📅 Attendance
✏️  Marks Entry
📢 Announcements
📈 My Reports
```

### Manager Sidebar
```
📊 Dashboard
💰 Fee Collection
🛍 Inventory & POS
📈 Reports
```

### Parent Panel
```
🏠 Home
📅 Attendance
📘 Results
💰 Fee Status
📢 Announcements
🗓 Timetable
```

---

## Wireframe Reference

### Student List Page

```
┌─────────────────────────────────────────────────────────┐
│  Students                          [+ Add Student]       │
│  Manage all students in your school  [↑ Excel Upload]   │
├─────────────────────────────────────────────────────────┤
│  [🔍 Search by name, admission no...]  [Class ▼] [Status ▼] [↓ Export] │
├─────────────────────────────────────────────────────────┤
│  ID   │ Name          │ Class    │ Parent Phone │ Fee Status │ Actions │
├───────┼───────────────┼──────────┼──────────────┼────────────┼─────────┤
│ #001  │ John Doe      │ Grade 5A │ 9876543210   │ ✅ Paid    │ [View] [Edit] │
│ #002  │ Jane Smith    │ Grade 5A │ 9876543211   │ 🟡 Partial │ [View] [Edit] │
│ #003  │ Ravi Kumar    │ Grade 6B │ 9876543212   │ 🔴 Due     │ [View] [Edit] │
├─────────────────────────────────────────────────────────┤
│  Showing 1-20 of 248    [← Prev] [1] [2] [3] ... [Next →] │
└─────────────────────────────────────────────────────────┘
```

### Fee Collection (POS) Screen

```
┌─────────────────────────────────────────────────────────┐
│  Fee Collection                                          │
├──────────────────────────┬──────────────────────────────┤
│  STUDENT SEARCH          │  FEE BREAKDOWN               │
│  [🔍 Name or ID...]      │  ─────────────────────────  │
│                          │  Academic Year: 2025-2026   │
│  ● John Doe              │                             │
│    Grade 5A | ADM-001    │  Tuition Fee:      ₹5,000  │
│                          │  Transport Fee:    ₹1,200  │
│                          │  Maintenance:        ₹500  │
│                          │  ─────────────────────────  │
│                          │  Subtotal:         ₹6,700  │
│                          │  Late Fee (12 days):  ₹600 │
│                          │  Discount:           -₹0   │
│                          │  ─────────────────────────  │
│                          │  TOTAL PAYABLE:    ₹7,300  │
│                          │                             │
│                          │  Already Paid:     ₹2,000  │
│                          │  NET DUE:          ₹5,300  │
│                          │  ─────────────────────────  │
│                          │  Payment Mode:              │
│                          │  ○ Cash  ○ UPI  ○ Card     │
│                          │                             │
│                          │  Amount: [₹______]          │
│                          │  Reference: [Optional]      │
│                          │                             │
│                          │  [  Collect Payment  ]      │
└──────────────────────────┴──────────────────────────────┘
```

### Add Student — Step Wizard

```
Step 1 of 4: Basic Information
────────────────────────────
First Name:     [______________]
Last Name:      [______________]
Date of Birth:  [______________]
Gender:         ○ Male ○ Female ○ Other
Blood Group:    [__________▼]
Photo:          [↑ Upload Photo]

                        [Cancel]  [Next →]

Progress: ●──○──○──○
```

---

## Form Design Rules

1. **Labels above inputs** — never placeholder-only labels (accessibility)
2. **Real-time validation** — show errors as user types (on blur)
3. **Required fields** marked with red asterisk `*`
4. **Submit button** disabled until required fields are filled
5. **Multi-step forms** show progress indicator
6. **Success** → toast notification + auto-close modal
7. **Error** → inline error message + toast for catch-all
8. **Destructive actions** → always show confirmation modal

```typescript
// Standard form structure
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
    <FormField
      control={form.control}
      name="first_name"
      render={({ field }) => (
        <FormItem>
          <FormLabel>First Name <span className="text-red-500">*</span></FormLabel>
          <FormControl>
            <Input placeholder="Enter first name" {...field} />
          </FormControl>
          <FormMessage />  {/* Shows Zod validation errors */}
        </FormItem>
      )}
    />
    <Button type="submit" disabled={form.formState.isSubmitting}>
      {form.formState.isSubmitting ? <Spinner /> : 'Save Student'}
    </Button>
  </form>
</Form>
```

---

## Table Design Rules

All data tables use the shared `DataTable` component:

```typescript
<DataTable
  columns={studentColumns}
  data={students}
  isLoading={isLoading}
  pagination={{
    total: totalCount,
    pageSize: 20,
    page: currentPage,
    onPageChange: setPage,
  }}
  searchable
  exportable
  emptyState={{
    title: 'No students found',
    description: 'Add your first student to get started',
    action: <Button onClick={openAddModal}><Plus /> Add Student</Button>
  }}
/>
```

---

## Mobile Responsiveness Requirements

| Component | Mobile Behavior |
|-----------|----------------|
| Sidebar | Collapsed by default; hamburger menu |
| Data tables | Horizontal scroll on mobile; priority columns always visible |
| Forms | Full width, stacked layout |
| Modals | Full screen sheets on mobile |
| Navbar | Logo + hamburger only |
| Dashboard cards | Single column stack |
| POS screen | Stacked layout (student lookup top, fee breakdown bottom) |

---

## Accessibility Requirements

- All form inputs have `aria-label` or associated `<label>`
- All icon-only buttons have `aria-label`
- All modals have `role="dialog"` and `aria-labelledby`
- Color is never the only indicator of status (always pair with text or icon)
- Focus trap in modals
- Skip-to-main-content link
- Tab navigation works for all interactive elements
- shadcn/ui components handle ARIA natively — use them

---

## Loading & Empty States

### Loading Pattern
```typescript
// Every data-loading page must have a skeleton
export default function StudentsPage() {
  const { data, isLoading } = useStudents()
  
  if (isLoading) return <StudentsTableSkeleton />
  return <StudentsTable data={data} />
}
```

### Empty State Pattern
```
┌─────────────────────────────┐
│                             │
│        📋                   │
│   No students yet           │
│   Add your first student    │
│   to get started.           │
│                             │
│   [+ Add Student]           │
│                             │
└─────────────────────────────┘
```

### Error State Pattern
```typescript
if (error) return (
  <Alert variant="destructive">
    <AlertTitle>Failed to load students</AlertTitle>
    <AlertDescription>
      {error.message} — <Button variant="link" onClick={refetch}>Try again</Button>
    </AlertDescription>
  </Alert>
)
```
