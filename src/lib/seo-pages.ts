export type SeoFaq = {
  question: string;
  answer: string;
};

export type SeoRelatedLink = {
  href: string;
  label: string;
};

export type SeoPage = {
  slug: string;
  title: string;
  metaDescription: string;
  h1: string;
  subheading: string;
  niche: string;
  audience: string;
  pains: string[];
  benefits: string[];
  features: string[];
  useCases: string[];
  faq: SeoFaq[];
  canonicalPath: string;
  relatedLinks: SeoRelatedLink[];
};

const commonRelatedLinks: SeoRelatedLink[] = [
  { href: "/demo", label: "View the LeadClaw demo" },
  { href: "/pricing", label: "Compare pricing" },
  { href: "/free-trial", label: "Start a free trial" },
];

export const seoPages: SeoPage[] = [
  {
    slug: "ai-receptionist-for-beauty-clinics-uk",
    title: "AI Receptionist for Beauty Clinics UK | LeadClaw",
    metaDescription:
      "LeadClaw helps UK beauty clinics capture treatment requests, organise follow-ups, and keep client enquiries moving with AI workflow automation.",
    h1: "AI receptionist for beauty clinics in the UK",
    subheading:
      "Capture new treatment requests, organise consultations, and follow up with potential clients without adding more repetitive admin to the day.",
    niche: "Beauty clinics",
    audience:
      "Independent beauty clinics, salon-led treatment teams, and multi-service studios that need a clearer way to manage website and social media requests.",
    pains: [
      "Consultation requests arrive through forms, DMs, calls, and email, then get buried during busy appointment days.",
      "Clients often ask the same preparation, pricing, and availability questions before they are ready to book.",
      "Manual follow-up is hard to keep consistent when the team is switching between treatments and reception tasks.",
      "High-intent requests can sit too long before anyone has the space to qualify and route them.",
    ],
    benefits: [
      "Respond to new requests with a structured intake flow that keeps essential details in one workspace.",
      "Give the team a clearer lead tracker for consultations, callbacks, and follow-up tasks.",
      "Reduce repetitive admin around first responses, reminders, and request summaries.",
      "Keep the client experience calm and organised without making clinical or treatment decisions.",
    ],
    features: [
      "AI Receptionist for website request capture",
      "Lead Tracker for consultation and booking interest",
      "Follow-Up Assistant for non-clinical reminders",
      "Weekly Report Bot for request volume and response trends",
    ],
    useCases: [
      "Capture facial, brows, lashes, skin, and body treatment requests from a website widget.",
      "Route new client details into a shared workspace for the right team member to review.",
      "Send polite follow-up prompts when a potential client has not replied.",
      "Summarise weekly enquiry sources, popular services, and open follow-up tasks.",
    ],
    faq: [
      {
        question: "Can LeadClaw answer treatment-specific beauty questions?",
        answer:
          "LeadClaw is designed for intake, routing, reminders, and administrative follow-up. Treatment advice and suitability decisions should stay with trained staff.",
      },
      {
        question: "Does LeadClaw replace reception staff?",
        answer:
          "No. It supports reception and admin teams by organising requests and reducing repetitive first-response work.",
      },
      {
        question: "Can it help with Instagram or website leads?",
        answer:
          "LeadClaw can help organise details from web requests and follow-up workflows. Social workflows should be connected carefully based on the channels you use.",
      },
      {
        question: "Is this only for larger beauty clinics?",
        answer:
          "No. Small teams can use the Basic intake widget, while busier clinics can add more workflow automation as request volume grows.",
      },
    ],
    canonicalPath: "/seo/ai-receptionist-for-beauty-clinics-uk",
    relatedLinks: [
      { href: "/seo/ai-receptionist-for-skin-clinics-uk", label: "AI receptionist for skin clinics" },
      { href: "/seo/ai-receptionist-for-med-spas-uk", label: "AI receptionist for med spas" },
      ...commonRelatedLinks,
    ],
  },
  {
    slug: "ai-receptionist-for-med-spas-uk",
    title: "AI Receptionist for Med Spas UK | LeadClaw",
    metaDescription:
      "Use LeadClaw to capture med spa requests, qualify admin details, organise follow-ups, and reduce repetitive intake work with AI.",
    h1: "AI receptionist for med spas in the UK",
    subheading:
      "A safer way to manage high-value treatment interest, consultation requests, and non-clinical follow-up across your med spa workflow.",
    niche: "Med spas",
    audience:
      "Med spas and advanced treatment studios that need consistent admin handling for consultation requests and repeat client interest.",
    pains: [
      "Prospective clients often need multiple touchpoints before they choose a consultation.",
      "Request details can be incomplete, making it harder for the team to prioritise callbacks.",
      "Follow-up windows are easy to miss when treatments, reception, and admin all compete for attention.",
      "Teams need clear boundaries between helpful admin automation and clinical decision-making.",
    ],
    benefits: [
      "Collect structured request details before a staff member reviews the next step.",
      "Keep consultation interest, open replies, and follow-up status visible in one place.",
      "Use AI to reduce repetitive admin while keeping suitability and treatment advice with your team.",
      "Spot request patterns across treatments, campaigns, and weekly activity.",
    ],
    features: [
      "AI Receptionist for structured treatment interest capture",
      "Lead Tracker for consultation and callback status",
      "Follow-Up Assistant for polite non-clinical nudges",
      "Document Extractor for organising admin notes and uploaded files",
    ],
    useCases: [
      "Capture interest in skin, laser, injectable, wellness, or consultation-led services.",
      "Ask for contact details, preferred times, and the main reason for the request.",
      "Route high-priority requests into a shared workspace for staff review.",
      "Create weekly summaries of new requests, pending replies, and admin bottlenecks.",
    ],
    faq: [
      {
        question: "Can LeadClaw decide whether someone is suitable for a med spa treatment?",
        answer:
          "No. LeadClaw supports admin intake and routing. Suitability, treatment planning, and advice remain with qualified professionals.",
      },
      {
        question: "Can the AI receptionist handle out-of-hours requests?",
        answer:
          "It can capture and organise requests at any time, so the team has clearer details to review when they are available.",
      },
      {
        question: "Does LeadClaw guarantee more bookings?",
        answer:
          "No. It helps improve request handling and follow-up consistency, but it does not guarantee leads, bookings, or rankings.",
      },
      {
        question: "Can med spas use LeadClaw with existing processes?",
        answer:
          "Yes. The goal is to add structured intake and follow-up around your current review and booking workflow.",
      },
    ],
    canonicalPath: "/seo/ai-receptionist-for-med-spas-uk",
    relatedLinks: [
      { href: "/seo/ai-receptionist-for-beauty-clinics-uk", label: "AI receptionist for beauty clinics" },
      { href: "/seo/ai-receptionist-for-cosmetic-surgery-clinics-uk", label: "AI receptionist for cosmetic surgery clinics" },
      ...commonRelatedLinks,
    ],
  },
  {
    slug: "ai-receptionist-for-skin-clinics-uk",
    title: "AI Receptionist for Skin Clinics UK | LeadClaw",
    metaDescription:
      "LeadClaw helps skin clinics capture consultation requests, organise admin tasks, and automate non-clinical follow-ups with AI workflows.",
    h1: "AI receptionist for skin clinics in the UK",
    subheading:
      "Keep new skin consultation requests organised, collect the right admin context, and make follow-up easier for your front desk or clinic team.",
    niche: "Skin clinics",
    audience:
      "Skin clinics, dermatology-adjacent private clinics, and consultation-led treatment providers managing a steady flow of client requests.",
    pains: [
      "Clients may submit vague requests that need careful admin triage before a consultation can be arranged.",
      "Before-and-after interest, treatment questions, and appointment timing can create repetitive message threads.",
      "Follow-up lists often sit across inboxes, spreadsheets, and staff notes.",
      "Teams need to avoid automated medical or suitability advice while still being responsive.",
    ],
    benefits: [
      "Capture contact details, request type, timing, and preferred next steps in a consistent intake flow.",
      "Give staff a central view of new requests and outstanding follow-ups.",
      "Automate safe admin prompts without making medical claims or treatment recommendations.",
      "Understand which services and request sources are creating the most admin load.",
    ],
    features: [
      "AI Receptionist for skin consultation request capture",
      "Lead Tracker for pending replies and next actions",
      "Follow-Up Assistant for consultation reminders",
      "Data Cleaner for organising request notes and duplicated details",
    ],
    useCases: [
      "Capture acne, pigmentation, laser, peel, or consultation interest from a website.",
      "Collect preferred contact times and the client's main goal before staff review.",
      "Track whether a request needs a callback, booking link, or further staff response.",
      "Prepare weekly summaries of new requests and unresolved follow-ups.",
    ],
    faq: [
      {
        question: "Does LeadClaw give skin advice?",
        answer:
          "No. LeadClaw is for admin intake, routing, and follow-up. Skin advice and treatment decisions should come from the appropriate professional.",
      },
      {
        question: "Can it help with consultation requests?",
        answer:
          "Yes. It helps collect structured details and keep the request visible for staff review.",
      },
      {
        question: "Can LeadClaw manage repeat client follow-ups?",
        answer:
          "It can support non-clinical follow-up tasks such as reminders, replies, and admin status tracking.",
      },
      {
        question: "Is the content indexable by Google?",
        answer:
          "This landing page is server-rendered, crawlable, and listed in the LeadClaw sitemap.",
      },
    ],
    canonicalPath: "/seo/ai-receptionist-for-skin-clinics-uk",
    relatedLinks: [
      { href: "/seo/ai-receptionist-for-beauty-clinics-uk", label: "AI receptionist for beauty clinics" },
      { href: "/seo/ai-receptionist-for-med-spas-uk", label: "AI receptionist for med spas" },
      ...commonRelatedLinks,
    ],
  },
  {
    slug: "ai-receptionist-for-physiotherapy-clinics-uk",
    title: "AI Receptionist for Physiotherapy Clinics UK | LeadClaw",
    metaDescription:
      "LeadClaw helps physiotherapy clinics capture appointment requests, organise admin work, and follow up with prospective patients using AI.",
    h1: "AI receptionist for physiotherapy clinics in the UK",
    subheading:
      "Capture appointment interest, route requests to your team, and keep admin follow-up moving without giving clinical advice.",
    niche: "Physiotherapy clinics",
    audience:
      "Private physiotherapy clinics, sports rehab teams, and multidisciplinary practices that need faster handling of appointment requests.",
    pains: [
      "New patients may request help outside opening hours and expect a prompt next step.",
      "Reception teams need enough context to route requests without collecting clinical decisions by chat.",
      "Missed calls and web forms can create duplicate records and unclear follow-up ownership.",
      "Busy treatment schedules make it hard to keep every admin reply moving.",
    ],
    benefits: [
      "Capture appointment request details in a structured, non-diagnostic format.",
      "Organise new patient interest, callbacks, and pending replies in a shared workspace.",
      "Support reception with safe admin automation while clinicians keep clinical judgement.",
      "Create weekly visibility into request sources, response gaps, and follow-up workload.",
    ],
    features: [
      "AI Receptionist for appointment request capture",
      "Lead Tracker for new patient and callback status",
      "Follow-Up Assistant for non-clinical admin reminders",
      "Weekly Report Bot for request and response summaries",
    ],
    useCases: [
      "Capture requests for physiotherapy, sports injury support, rehab, or mobility appointments.",
      "Collect contact details, location preference, availability, and the requested service type.",
      "Route new requests for reception review before booking or escalation.",
      "Follow up with prospects who asked for availability but have not replied.",
    ],
    faq: [
      {
        question: "Can LeadClaw triage injuries or give physiotherapy advice?",
        answer:
          "No. It is for administrative intake and workflow support only. Clinical triage and advice remain with qualified professionals.",
      },
      {
        question: "Can it capture out-of-hours appointment requests?",
        answer:
          "Yes. LeadClaw can collect structured request details while the team is unavailable, ready for later review.",
      },
      {
        question: "Can it support multiple clinic locations?",
        answer:
          "The workflow can collect location preference and route requests according to your operational setup.",
      },
      {
        question: "Will it replace a receptionist?",
        answer:
          "No. It supports reception teams by reducing repetitive admin and keeping requests organised.",
      },
    ],
    canonicalPath: "/seo/ai-receptionist-for-physiotherapy-clinics-uk",
    relatedLinks: [
      { href: "/seo/ai-receptionist-for-chiropractors-uk", label: "AI receptionist for chiropractors" },
      { href: "/seo/ai-receptionist-for-osteopaths-uk", label: "AI receptionist for osteopaths" },
      ...commonRelatedLinks,
    ],
  },
  {
    slug: "ai-receptionist-for-chiropractors-uk",
    title: "AI Receptionist for Chiropractors UK | LeadClaw",
    metaDescription:
      "LeadClaw helps chiropractic clinics capture new patient requests, track callbacks, and automate safe admin follow-up with AI.",
    h1: "AI receptionist for chiropractors in the UK",
    subheading:
      "Give your chiropractic practice a clearer way to capture new patient interest, organise callbacks, and reduce repetitive front-desk admin.",
    niche: "Chiropractors",
    audience:
      "Chiropractic clinics and private practices that receive appointment requests through websites, calls, email, and referral pages.",
    pains: [
      "New patient requests often need a quick admin response before the person books elsewhere.",
      "Reception staff may need to ask the same availability and contact questions repeatedly.",
      "Missed calls can turn into unclear follow-up lists without a shared lead tracker.",
      "Clinics must keep automated messaging away from diagnosis or treatment advice.",
    ],
    benefits: [
      "Capture new patient request details without presenting medical advice or claims.",
      "Track callback status, preferred times, and booking interest in one workspace.",
      "Use automated follow-up to keep admin conversations from going cold.",
      "See weekly patterns in request volume, sources, and pending next steps.",
    ],
    features: [
      "AI Receptionist for new patient request capture",
      "Lead Tracker for callback and booking interest",
      "Follow-Up Assistant for non-clinical reminders",
      "Data Cleaner for tidying duplicated contact details",
    ],
    useCases: [
      "Capture website requests for first appointments, returning patients, or general availability.",
      "Collect contact details and preferred callback times for reception review.",
      "Flag unanswered requests so the team can prioritise follow-up.",
      "Summarise weekly admin workload and sources of new patient interest.",
    ],
    faq: [
      {
        question: "Does LeadClaw diagnose or advise chiropractic patients?",
        answer:
          "No. LeadClaw is for admin intake and follow-up. Diagnosis, advice, and care decisions remain with the clinic.",
      },
      {
        question: "Can it help with missed calls?",
        answer:
          "Yes. It can support missed-call recovery workflows by capturing details and prompting non-clinical follow-up.",
      },
      {
        question: "Can chiropractic staff review every request?",
        answer:
          "Yes. LeadClaw organises the workflow so your team can review requests before booking or escalation.",
      },
      {
        question: "Is setup complicated?",
        answer:
          "The initial workflow can start with a website intake widget and expand as your admin process becomes clearer.",
      },
    ],
    canonicalPath: "/seo/ai-receptionist-for-chiropractors-uk",
    relatedLinks: [
      { href: "/seo/ai-receptionist-for-physiotherapy-clinics-uk", label: "AI receptionist for physiotherapy clinics" },
      { href: "/seo/ai-receptionist-for-osteopaths-uk", label: "AI receptionist for osteopaths" },
      ...commonRelatedLinks,
    ],
  },
  {
    slug: "ai-receptionist-for-osteopaths-uk",
    title: "AI Receptionist for Osteopaths UK | LeadClaw",
    metaDescription:
      "LeadClaw helps osteopathy clinics capture appointment requests, organise follow-ups, and reduce repetitive admin with AI workflows.",
    h1: "AI receptionist for osteopaths in the UK",
    subheading:
      "A practical intake and follow-up layer for osteopathy clinics that want clearer request handling without automating clinical decisions.",
    niche: "Osteopaths",
    audience:
      "Osteopathy clinics, solo practitioners, and wellbeing practices that need reliable admin support around new patient enquiries.",
    pains: [
      "Appointment interest may arrive while practitioners are in sessions and unable to reply quickly.",
      "Requests can lack key admin details such as contact preferences, location, and availability.",
      "Manual follow-up can be inconsistent when admin support is part-time or shared.",
      "Automated tools need to stay focused on operations rather than clinical assessment.",
    ],
    benefits: [
      "Capture new patient requests in a structured way for later staff review.",
      "Keep follow-up tasks visible across open enquiries, replies, and callback lists.",
      "Reduce repeated admin questions around availability and preferred contact details.",
      "Maintain clear boundaries between workflow automation and professional judgement.",
    ],
    features: [
      "AI Receptionist for web request capture",
      "Lead Tracker for new patient interest",
      "Follow-Up Assistant for admin prompts",
      "Weekly Report Bot for clinic request summaries",
    ],
    useCases: [
      "Collect appointment requests from a website without needing a full form rebuild.",
      "Ask for contact details, preferred times, and broad service interest.",
      "Route requests to the right person for booking, callback, or review.",
      "Report on open requests and response gaps at the end of each week.",
    ],
    faq: [
      {
        question: "Can LeadClaw assess symptoms for osteopathy patients?",
        answer:
          "No. LeadClaw should be used for admin intake and routing only. Assessment and advice remain with qualified professionals.",
      },
      {
        question: "Can it work for solo osteopaths?",
        answer:
          "Yes. It can help solo practitioners keep requests organised when they are away from the desk.",
      },
      {
        question: "Can it send follow-ups?",
        answer:
          "It can support non-clinical follow-up workflows, such as reminders to reply or prompts to complete next-step details.",
      },
      {
        question: "Does it require changing my booking system?",
        answer:
          "Not necessarily. LeadClaw can start as an intake and workflow layer around your existing admin process.",
      },
    ],
    canonicalPath: "/seo/ai-receptionist-for-osteopaths-uk",
    relatedLinks: [
      { href: "/seo/ai-receptionist-for-physiotherapy-clinics-uk", label: "AI receptionist for physiotherapy clinics" },
      { href: "/seo/ai-receptionist-for-chiropractors-uk", label: "AI receptionist for chiropractors" },
      ...commonRelatedLinks,
    ],
  },
  {
    slug: "dental-missed-call-recovery-uk",
    title: "Dental Missed Call Recovery UK | LeadClaw",
    metaDescription:
      "LeadClaw helps dental practices capture missed enquiries, organise callbacks, and automate safe non-clinical follow-up workflows.",
    h1: "Dental missed call recovery for UK practices",
    subheading:
      "Turn missed calls and web requests into organised callback tasks, clear intake notes, and safer non-clinical follow-up workflows.",
    niche: "Dental practices",
    audience:
      "Private dental practices, mixed practices, and treatment coordinators who want a clearer process for missed patient enquiries.",
    pains: [
      "Missed calls can disappear into voicemail or call logs before anyone owns the follow-up.",
      "High-value treatment interest may need fast admin contact and careful handover.",
      "Callback notes often sit outside the main lead tracking workflow.",
      "Dental practices need follow-up automation that avoids clinical advice and treatment promises.",
    ],
    benefits: [
      "Capture missed enquiry details and keep callback status visible.",
      "Organise treatment interest, preferred times, and contact details for team review.",
      "Support reception and treatment coordination with consistent non-clinical follow-up.",
      "Understand weekly missed enquiry volume and unresolved callback tasks.",
    ],
    features: [
      "Missed request capture for calls and website interest",
      "Lead Tracker for callback and treatment enquiry status",
      "Follow-Up Assistant for non-clinical reminders",
      "Weekly Report Bot for missed enquiry trends",
    ],
    useCases: [
      "Recover implant, orthodontic, hygiene, cosmetic, or general appointment interest.",
      "Create callback tasks from missed enquiries and website requests.",
      "Track whether each request is new, contacted, booked, or still pending.",
      "Summarise missed-call recovery activity for the practice manager.",
    ],
    faq: [
      {
        question: "Does LeadClaw give dental advice?",
        answer:
          "No. It supports admin intake, callback tracking, and follow-up. Dental advice and treatment planning remain with the practice.",
      },
      {
        question: "Can it guarantee recovered patients?",
        answer:
          "No. LeadClaw improves organisation and follow-up consistency but does not guarantee bookings or patient outcomes.",
      },
      {
        question: "Can treatment coordinators use it?",
        answer:
          "Yes. It can help treatment coordinators see new interest, callback status, and pending replies in one workflow.",
      },
      {
        question: "Can it work with existing phone processes?",
        answer:
          "Yes. It can support the admin workflow around missed calls and web requests without replacing your phone system.",
      },
    ],
    canonicalPath: "/seo/dental-missed-call-recovery-uk",
    relatedLinks: [
      { href: "/seo/dental-lead-generation-software-uk", label: "Dental lead generation software" },
      { href: "/seo/ai-agent-for-dental-clinics-uk", label: "AI workflow automation for dental clinics" },
      ...commonRelatedLinks,
    ],
  },
  {
    slug: "dental-lead-generation-software-uk",
    title: "Dental Lead Generation Software UK | LeadClaw",
    metaDescription:
      "LeadClaw gives dental practices AI-powered intake, lead tracking, and follow-up automation for treatment and appointment enquiries.",
    h1: "Dental lead generation software for UK practices",
    subheading:
      "Capture treatment enquiries, organise callbacks, and keep dental lead follow-up moving with AI workflow automation.",
    niche: "Dental lead generation",
    audience:
      "Dental practices and treatment teams that want better handling of website enquiries, campaign responses, and consultation requests.",
    pains: [
      "Marketing campaigns can create enquiries faster than the team can manually qualify them.",
      "Implant, aligner, cosmetic, and general requests often need different admin next steps.",
      "Lead spreadsheets become stale when ownership and status are unclear.",
      "Practices need cautious wording that avoids treatment guarantees or clinical advice.",
    ],
    benefits: [
      "Capture lead details in a structured flow before the team reviews the next step.",
      "Track status across new, contacted, booked, and pending dental enquiries.",
      "Automate non-clinical reminders so fewer conversations are left unattended.",
      "Report on sources, services, and follow-up gaps without manual spreadsheet cleanup.",
    ],
    features: [
      "AI Receptionist for dental enquiry capture",
      "Lead Tracker for treatment interest and callback status",
      "Follow-Up Assistant for admin reminders",
      "Data Cleaner for duplicate and incomplete lead details",
    ],
    useCases: [
      "Capture implant, Invisalign-style, whitening, cosmetic, hygiene, or general appointment requests.",
      "Route leads by requested service or location for staff review.",
      "Follow up with prospects who requested information but did not book.",
      "Summarise lead volume and response gaps for practice marketing reviews.",
    ],
    faq: [
      {
        question: "Is LeadClaw a dental marketing agency?",
        answer:
          "No. LeadClaw is an AI workflow automation suite for capturing, organising, and following up with enquiries.",
      },
      {
        question: "Does it guarantee dental leads?",
        answer:
          "No. It helps manage and follow up with enquiries but does not guarantee lead volume, bookings, or rankings.",
      },
      {
        question: "Can it support treatment coordinator workflows?",
        answer:
          "Yes. It can organise request details, status, and next-step tasks for treatment coordination teams.",
      },
      {
        question: "Can staff approve messages?",
        answer:
          "LeadClaw workflows can be configured around staff review, especially for sensitive or regulated communication.",
      },
    ],
    canonicalPath: "/seo/dental-lead-generation-software-uk",
    relatedLinks: [
      { href: "/seo/dental-missed-call-recovery-uk", label: "Dental missed call recovery" },
      { href: "/seo/ai-agent-for-dental-clinics-uk", label: "AI workflow automation for dental clinics" },
      ...commonRelatedLinks,
    ],
  },
  {
    slug: "ai-receptionist-for-hair-transplant-clinics-uk",
    title: "AI Receptionist for Hair Transplant Clinics UK | LeadClaw",
    metaDescription:
      "LeadClaw helps hair transplant clinics capture consultation requests, organise lead follow-up, and reduce repetitive admin with AI.",
    h1: "AI receptionist for hair transplant clinics in the UK",
    subheading:
      "Manage high-value consultation interest with structured intake, clear follow-up status, and admin automation that keeps clinical review separate.",
    niche: "Hair transplant clinics",
    audience:
      "Hair transplant clinics and consultation teams handling website enquiries, campaign leads, and follow-up-heavy patient journeys.",
    pains: [
      "Prospects often compare providers and need careful, timely admin follow-up.",
      "Consultation requests may require photos, preferences, contact details, and multiple touchpoints.",
      "Lead status can become unclear across sales, reception, and clinical review steps.",
      "Automation must avoid promises about suitability, results, or medical outcomes.",
    ],
    benefits: [
      "Capture consultation interest in a structured workflow before staff review.",
      "Keep follow-up tasks visible across new, contacted, reviewing, and pending enquiries.",
      "Reduce repetitive admin around first responses, reminders, and lead summaries.",
      "Support compliant communication boundaries by keeping advice and suitability with professionals.",
    ],
    features: [
      "AI Receptionist for consultation request capture",
      "Lead Tracker for high-value enquiry stages",
      "Document Extractor for organising uploaded admin materials",
      "Follow-Up Assistant for non-clinical next-step reminders",
    ],
    useCases: [
      "Capture hair restoration consultation requests from website visitors.",
      "Collect contact details, preferred times, location, and broad treatment interest.",
      "Track whether a request needs a callback, photo review workflow, or consultation booking.",
      "Summarise weekly lead stages and unresolved follow-up tasks.",
    ],
    faq: [
      {
        question: "Can LeadClaw assess hair transplant suitability?",
        answer:
          "No. LeadClaw handles administrative intake and workflow support. Suitability and treatment advice remain with qualified professionals.",
      },
      {
        question: "Can it handle uploaded photos or documents?",
        answer:
          "It can support workflows that organise uploaded admin materials for staff review, depending on your configured process.",
      },
      {
        question: "Does it promise more consultations?",
        answer:
          "No. It helps organise intake and follow-up but does not guarantee enquiries, bookings, or outcomes.",
      },
      {
        question: "Can it help with long follow-up cycles?",
        answer:
          "Yes. LeadClaw is useful when prospects need several non-clinical reminders and clear next steps before booking.",
      },
    ],
    canonicalPath: "/seo/ai-receptionist-for-hair-transplant-clinics-uk",
    relatedLinks: [
      { href: "/seo/ai-receptionist-for-cosmetic-surgery-clinics-uk", label: "AI receptionist for cosmetic surgery clinics" },
      { href: "/seo/ai-receptionist-for-med-spas-uk", label: "AI receptionist for med spas" },
      ...commonRelatedLinks,
    ],
  },
  {
    slug: "ai-receptionist-for-cosmetic-surgery-clinics-uk",
    title: "AI Receptionist for Cosmetic Surgery Clinics UK | LeadClaw",
    metaDescription:
      "LeadClaw helps cosmetic surgery clinics capture consultation requests, route admin work, and automate safe follow-up workflows.",
    h1: "AI receptionist for cosmetic surgery clinics in the UK",
    subheading:
      "A workflow automation layer for consultation-led cosmetic clinics that need structured intake, careful follow-up, and clear staff review.",
    niche: "Cosmetic surgery clinics",
    audience:
      "Cosmetic surgery clinics, patient coordinators, and private practice teams managing complex consultation and follow-up journeys.",
    pains: [
      "High-value consultation requests often involve multiple admin steps before a patient coordinator can respond properly.",
      "Incomplete details slow down callbacks and create repeated messages.",
      "Teams need consistent follow-up without making medical claims, outcome promises, or suitability decisions.",
      "Lead status can be hard to track across web forms, calls, inboxes, and coordinator notes.",
    ],
    benefits: [
      "Capture structured consultation interest and preferred next steps for staff review.",
      "Track request status across coordinator follow-up, pending replies, and booked consultations.",
      "Automate safe non-clinical admin prompts while keeping medical decisions with professionals.",
      "Create weekly visibility into request volume, source quality, and open follow-up workload.",
    ],
    features: [
      "AI Receptionist for consultation request intake",
      "Lead Tracker for patient coordinator workflows",
      "Document Extractor for organising admin materials",
      "Weekly Report Bot for high-value request summaries",
    ],
    useCases: [
      "Capture requests for consultation-led cosmetic procedures without giving advice.",
      "Collect contact details, preferred times, broad area of interest, and next-step preferences.",
      "Route requests for coordinator review before any clinical conversation.",
      "Monitor pending replies and unresolved follow-up tasks across the week.",
    ],
    faq: [
      {
        question: "Can LeadClaw advise on cosmetic surgery options?",
        answer:
          "No. LeadClaw supports administrative intake and follow-up only. Advice, suitability, and consent discussions remain with qualified professionals.",
      },
      {
        question: "Can it replace patient coordinators?",
        answer:
          "No. It helps coordinators organise requests and reduce repetitive admin, but staff remain central to review and communication.",
      },
      {
        question: "Can it handle sensitive enquiries?",
        answer:
          "It can support structured intake and routing, but sensitive workflows should be configured with appropriate staff review and data handling.",
      },
      {
        question: "Does it guarantee bookings?",
        answer:
          "No. LeadClaw improves workflow visibility and follow-up consistency but does not guarantee bookings or outcomes.",
      },
    ],
    canonicalPath: "/seo/ai-receptionist-for-cosmetic-surgery-clinics-uk",
    relatedLinks: [
      { href: "/seo/ai-receptionist-for-hair-transplant-clinics-uk", label: "AI receptionist for hair transplant clinics" },
      { href: "/seo/ai-receptionist-for-med-spas-uk", label: "AI receptionist for med spas" },
      ...commonRelatedLinks,
    ],
  },
];

export function getSeoPage(slug: string) {
  return seoPages.find((page) => page.slug === slug);
}
