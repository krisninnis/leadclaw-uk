export default function DemoPage() {
  return (
    <div className="max-w-4xl mx-auto py-16 px-6 space-y-8">
      <h1 className="text-4xl font-bold">
        Try the AI Receptionist Live
      </h1>

      <p className="text-lg text-slate-600">
        Send a message below to see how LeadClaw captures enquiries
        and responds instantly to clinic visitors.
      </p>

      <div className="rounded-xl border p-6 bg-white">
        <p className="text-sm text-slate-500 mb-4">
          Example questions you can ask:
        </p>

        <ul className="list-disc pl-6 text-sm text-slate-600 space-y-1">
          <li>How much is Botox?</li>
          <li>Do you offer teeth whitening?</li>
          <li>Can I book a consultation?</li>
          <li>Where are you located?</li>
        </ul>
      </div>

      <div className="text-center pt-6">
        <a
          href="/pricing"
          className="inline-block bg-black text-white px-6 py-3 rounded-lg"
        >
          Start Free Trial
        </a>
      </div>
    </div>
  )
}