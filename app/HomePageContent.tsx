'use client'

import { useSearchParams } from 'next/navigation'
import HomePage from './HomePage'

export default function HomePageContent() {
  const searchParams = useSearchParams()
  const redirectedFrom = searchParams.get('redirectedFrom')

  return <HomePage redirectedFrom={redirectedFrom} />
}