export default function JobQueuesPage() {
  const apiUrl = process.env.ADMIN_API_URL ?? 'http://localhost:3001'
  const boardUrl = `${apiUrl}/admin/queues`
  const secret = process.env.ADMIN_SECRET ?? ''
  // Show only last 8 chars as a hint — admin is already authenticated to see this page
  const secretHint = secret.length > 8 ? `...${secret.slice(-8)}` : secret

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] gap-3">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-white">Job Queues</h1>
          <p className="text-sm text-gray-400 mt-0.5">OCR · Reports · Insights — powered by BullMQ</p>
        </div>
        <a
          href={boardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Open in new tab ↗
        </a>
      </div>

      <div className="bg-gray-800 rounded-lg px-4 py-2.5 flex items-center gap-6 text-xs text-gray-400 flex-shrink-0">
        <span>First load will prompt for Basic Auth</span>
        <span className="text-gray-600">|</span>
        <span>Username: <code className="text-gray-200">admin</code></span>
        <span className="text-gray-600">|</span>
        <span>Password: <code className="text-gray-200 font-mono">{secretHint}</code> (your Admin Secret)</span>
      </div>

      <iframe
        src={boardUrl}
        className="flex-1 w-full rounded-lg border border-gray-700"
        title="Bull Board — Job Queue Monitor"
      />
    </div>
  )
}
