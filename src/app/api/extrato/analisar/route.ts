import { NextResponse } from 'next/server'

// Análise por IA removida — o extrato agora usa categorização manual pelo usuário.
export async function POST() {
  return NextResponse.json({ error: 'Endpoint descontinuado. Use a categorização manual no extrato.' }, { status: 410 })
}
