// Edge Function: generate-pdf
// Phase 2 — PDF generation for fee receipts, report cards

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  // TODO: Implement PDF generation in Phase 2
  return new Response(JSON.stringify({ error: 'Not implemented yet — Phase 2' }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' },
  })
})
