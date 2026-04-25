import ThreadDetailClient from '@/components/threads/ThreadDetailClient'

export default async function ThreadDetailPage({ params }: { params: Promise<{ tid: string }> }) {
  const { tid } = await params
  return <ThreadDetailClient tid={tid} initialThread={null} initialReply={null} initialMessages={[]} />
}
