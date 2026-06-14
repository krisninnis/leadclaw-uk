import type { Metadata } from "next";

export type SeoArticleFaq = {
  question: string;
  answer: string;
};

export type SeoArticleRelatedLink = {
  href: string;
  label: string;
};

export type SeoArticleSection = {
  id: string;
  eyebrow: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type SeoArticlePage = {
  slug: string;
  badge: string;
  title: string;
  metaDescription: string;
  h1: string;
  canonicalPath: string;
  intro: string[];
  sections: SeoArticleSection[];
  faqHeading: string;
  faq: SeoArticleFaq[];
  relatedLinks: SeoArticleRelatedLink[];
  articleSection: string;
  datePublished: string;
  dateModified: string;
};

const siteUrl = "https://www.leadclaw.uk";
const ogImage = "/brand/mascots/panther-growth.jpg";

const coreRelatedLinks: SeoArticleRelatedLink[] = [
  { href: "/ai-receptionist-uk", label: "AI receptionist UK guide" },
  { href: "/pricing", label: "LeadClaw pricing" },
  { href: "/free-trial", label: "Start a free trial" },
  { href: "/compare", label: "Compare AI receptionist options" },
];

export const seoArticlePages: SeoArticlePage[] = [
  {
    slug: "ai-receptionist-vs-answering-service",
    badge: "Comparison guide",
    title: "AI Receptionist vs Answering Service UK | LeadClaw",
    metaDescription:
      "Compare AI receptionists with traditional answering services for UK businesses. Understand costs, coverage, handover, missed calls, and when each option fits.",
    h1: "AI receptionist vs answering service: which is right for a UK business?",
    canonicalPath: "/ai-receptionist-vs-answering-service",
    articleSection: "AI receptionist comparisons",
    datePublished: "2026-06-14",
    dateModified: "2026-06-14",
    intro: [
      `An AI receptionist and an answering service are often bought for the same reason: the business is missing enquiries when staff are busy, closed, driving, in appointments, or on jobs. Both options can improve the first response a customer receives. The difference is how they work, what they cost, how they scale, and how much control your team has over the follow-up process.`,
      `For a UK service business, the choice should not be framed as software versus people. The better question is what part of the enquiry journey is breaking. If customers need a human conversation from the first second, an answering service can be useful. If the business mainly needs reliable capture, qualification, missed call recovery, and follow-up visibility, an AI receptionist can be a more practical first step.`,
      `This guide explains the difference in plain English. It covers how answering services work, how AI receptionists work, pricing considerations, strengths and weaknesses, UK business examples, and the signs that LeadClaw may be a better fit than a traditional call answering package.`,
    ],
    sections: [
      {
        id: "definitions",
        eyebrow: "Basics",
        title: "What each option actually does",
        paragraphs: [
          `An answering service is usually a team of remote human operators who answer calls on behalf of another business. The operator may follow a script, take a message, transfer urgent calls, book a slot, or email a call summary to the business. The customer hears a human voice, which can feel familiar and reassuring, especially for urgent or sensitive enquiries.`,
          `An AI receptionist is software that handles structured intake and first response. It can greet website visitors, ask safe qualification questions, collect contact details, support missed call recovery, organise requests in a workspace, and prompt follow-up. It is not there to pretend to be a person or make judgement calls. It is there to stop enquiries from falling through gaps.`,
          `LeadClaw sits in the AI receptionist category, but with a wider workflow focus. It helps businesses capture requests, track leads, automate follow-ups, and reduce repetitive admin. That makes it useful when calls, web forms, emails, and callback notes are spread across too many places. The product is designed to keep the first response simple and the next action visible.`,
        ],
        bullets: [
          "Answering services are strongest when every first conversation needs a trained human operator.",
          "AI receptionists are strongest when the main problem is repeated enquiry capture and follow-up admin.",
          "Both options can coexist if high-value calls need people and routine intake needs automation.",
          "The right choice depends on enquiry volume, urgency, complexity, budget, and internal follow-up discipline.",
        ],
      },
      {
        id: "coverage",
        eyebrow: "Availability",
        title: "Coverage, response speed, and out-of-hours enquiries",
        paragraphs: [
          `Coverage is one of the biggest reasons businesses compare these options. A small team may answer calls well at quiet times but miss them during jobs, treatments, meetings, viewings, workshop work, school runs, or after closing. The customer does not always know why no one answered. They simply need a clear route to the next step.`,
          `Answering services can provide extended hours, but the details depend on the package. Some include weekday cover only. Some charge more for evenings, weekends, overflow, or higher call volume. Some are excellent for urgent call handling, but the business still needs to make sure messages are routed into the right internal workflow quickly enough to matter.`,
          `An AI receptionist can be available all the time because it is not limited by operator shifts. For routine requests, it can collect the same core information at midnight as it does at 10am. That matters for trades, clinics, garages, estate agents, consultants, and other service businesses where a customer may search after work and expect an easy way to ask for help.`,
          `The practical question is not just whether the call is answered. It is whether the enquiry becomes usable. If an answering service sends a message to an inbox that no one checks until tomorrow afternoon, the customer may still drift away. If an AI receptionist captures the request and places it in a visible lead tracker, the business may have a clearer follow-up process.`,
        ],
      },
      {
        id: "handover",
        eyebrow: "Workflow",
        title: "Handover quality and follow-up visibility",
        paragraphs: [
          `Handover is where many reception solutions succeed or fail. A friendly first response is useful, but the business still needs the customer name, contact details, service needed, location, urgency, preferred time, and next action. If those details are incomplete, scattered, or trapped in a call note, staff spend time chasing context before they can help.`,
          `Human answering services can take good notes when the script is clear. They may also handle nuance better than software when a customer is upset, confused, or asking a complicated question. The risk is consistency. Different operators may summarise differently, follow different scripts, or miss details if the call does not fit the template.`,
          `AI receptionists can be very consistent for structured intake. They ask the same safe questions and store the same fields each time. That is especially useful for quote requests, callback requests, appointment interest, MOT bookings, valuation requests, emergency callouts, and after-hours enquiries. The limitation is that humans still need to own judgement, exceptions, and sensitive cases.`,
          `LeadClaw is built around that handover principle. The AI receptionist captures and organises the first request, then the team decides what to do. The value is not only the automated response; it is the shared workspace where leads and follow-up tasks are less likely to vanish into personal phones, voicemail, sticky notes, or a busy inbox.`,
        ],
        bullets: [
          "Good handover includes the customer need, contact route, urgency, location, and next action.",
          "AI intake works best when the questions are simple, safe, and repeatable.",
          "Human review should remain in place for complaints, regulated advice, sensitive cases, and exceptions.",
          "A lead tracker is often more valuable than another email notification.",
        ],
      },
      {
        id: "pricing",
        eyebrow: "Cost",
        title: "Pricing differences between AI receptionists and answering services",
        paragraphs: [
          `Answering services are commonly priced around human capacity. Packages may depend on call volume, call length, operator time, opening hours, transfer rules, setup, scripts, message taking, and add-ons. That structure is logical because the provider is staffing a human service. It can also make monthly costs harder to predict when enquiry volume changes.`,
          `AI receptionist pricing is usually software based. It may be a monthly subscription, a usage allowance, a conversation limit, or a plan with included features. The cost should be compared against the work it replaces or improves: missed call recovery, website enquiry capture, first response, lead organisation, follow-up prompts, and admin visibility.`,
          `The cheapest option on paper is not always the cheapest in practice. A low-cost answering service that only emails messages may still leave staff with manual follow-up and reporting work. A basic AI widget that answers questions but does not capture leads may not solve the commercial problem. A useful comparison should ask what happens after the enquiry is taken.`,
          `For many UK businesses, the break-even point can be simple. If one recovered booking, quote, callout, valuation, service appointment, or consultation covers a month of software, the product is worth testing. That is why LeadClaw provides public pricing and a free trial. You can compare plans on the pricing page before deciding whether the workflow fits.`,
        ],
        bullets: [
          "Check whether pricing is fixed monthly, per call, per minute, per conversation, or feature based.",
          "Look for setup charges, overflow charges, evening or weekend charges, and usage limits.",
          "Compare the cost of missed enquiries, not only the cost of answering them.",
          "Use the free trial to test real enquiry capture before committing.",
        ],
      },
      {
        id: "customer-experience",
        eyebrow: "Experience",
        title: "Which option feels better to customers?",
        paragraphs: [
          `A human voice can be reassuring. For urgent, emotional, or complex calls, a good operator may create a better first impression than a software flow. That is why answering services remain useful in many sectors. A person can hear hesitation, ask clarifying questions naturally, and calm a caller when the issue is not straightforward.`,
          `AI can still create a good customer experience when it is transparent and useful. Customers often accept automation if it helps them get something done quickly. A clear AI receptionist that says what it can do, collects the right details, and promises a realistic callback can feel better than ringing out, leaving a voicemail, or waiting days for a form reply.`,
          `The worst experience is not always AI. It is uncertainty. A customer who calls three businesses and reaches only voicemail may choose the one that gives them confidence first. A website visitor who cannot find a simple contact path may leave before the team knows they existed. Reception technology should reduce that uncertainty.`,
          `The safest approach is to set boundaries. Do not use AI to make promises it cannot keep. Do not hide the fact that it is automated. Do not ask for unnecessary personal information. Do make it easy to request a callback, describe the problem, and understand what happens next. That is the standard a practical AI receptionist should meet.`,
        ],
      },
      {
        id: "examples",
        eyebrow: "Use cases",
        title: "UK business examples",
        paragraphs: [
          `A plumber may miss calls while under a sink, driving between jobs, or dealing with an emergency. An answering service can take the call and pass on a message. An AI receptionist can capture the job type, postcode, urgency, photos if the process allows, and preferred callback time, then keep the request in a lead tracker for follow-up.`,
          `A dental practice or clinic may want a calm human voice for certain calls, but still need structured intake for website requests and after-hours appointment interest. AI can collect administrative details and route the request without giving clinical advice. Staff still decide what is appropriate, but the initial enquiry no longer waits unseen in an inbox.`,
          `A garage may receive MOT, service, repair, tyre, and diagnostic requests while staff are in the workshop. A human answering service can help with calls, but an AI receptionist can also capture website visitors, collect vehicle details, and turn repeated questions into a clearer workflow. The value is not only call answering; it is reducing admin between calls.`,
          `An estate agent may need fast handling for valuation requests and viewing enquiries. A human operator can be helpful for nuanced conversations, but AI can make sure basic details are captured out of hours. That gives the team a cleaner morning list and reduces the chance that a motivated vendor or buyer is left waiting.`,
        ],
      },
      {
        id: "decision",
        eyebrow: "Decision",
        title: "When to choose an AI receptionist, an answering service, or both",
        paragraphs: [
          `Choose an answering service when your first interaction must be human, your calls are highly sensitive, or you need live transfer and personal judgement on a regular basis. It can also be a good fit if your brand relies heavily on spoken service and you are comfortable paying for operator time.`,
          `Choose an AI receptionist when your main issue is missed call recovery, web enquiry capture, after-hours intake, quote requests, routine questions, follow-up visibility, or admin consistency. It is especially useful when your team is small and cannot justify a full reception layer, but still needs customers to receive a clear first response.`,
          `Choose both when you have high-value calls that deserve human handling and a large volume of routine enquiries that can be captured by software. In that model, the answering service deals with live human call handling, while the AI receptionist covers the repetitive and out-of-hours workflow around it.`,
          `LeadClaw is designed for businesses that want to start with the practical software layer. The AI receptionist captures requests, the lead tracker keeps them visible, and follow-up support helps the team stay on top of next actions. You can review the wider options on the comparison page or start directly with a free trial.`,
        ],
      },
    ],
    faqHeading: "AI receptionist vs answering service FAQ",
    faq: [
      {
        question: "Is an AI receptionist the same as an answering service?",
        answer:
          "No. An answering service usually uses human operators to answer calls. An AI receptionist uses software to capture requests, answer safe common questions, organise details, and support follow-up.",
      },
      {
        question: "Can an AI receptionist replace an answering service?",
        answer:
          "It can replace some routine intake work, but it should not replace human judgement where calls are sensitive, complex, regulated, or emotionally difficult. Many businesses use AI for routine capture and people for exceptions.",
      },
      {
        question: "Which option is cheaper?",
        answer:
          "It depends on call volume, operating hours, service depth, and usage. AI receptionists are often easier to trial because they are software based, while answering services usually reflect the cost of human operator time.",
      },
      {
        question: "Will customers dislike an AI receptionist?",
        answer:
          "Customers are more likely to accept automation when it is clear, useful, and easy to exit. A polite AI flow that captures a callback request can be better than no response, voicemail, or a slow form.",
      },
      {
        question: "Does LeadClaw include a free trial?",
        answer:
          "Yes. LeadClaw offers a free trial so UK businesses can test enquiry capture, missed call recovery, lead tracking, and follow-up support before choosing a plan.",
      },
    ],
    relatedLinks: [
      { href: "/ai-receptionist-vs-virtual-receptionist", label: "AI receptionist vs virtual receptionist" },
      { href: "/how-much-does-an-answering-service-cost-uk", label: "Answering service costs UK" },
      { href: "/missed-call-statistics-uk", label: "Missed call statistics UK" },
      ...coreRelatedLinks,
    ],
  },
  {
    slug: "ai-receptionist-vs-virtual-receptionist",
    badge: "Comparison guide",
    title: "AI Receptionist vs Virtual Receptionist UK | LeadClaw",
    metaDescription:
      "Compare AI receptionists and virtual receptionists for UK service businesses. Learn the differences in cost, availability, customer experience, and follow-up.",
    h1: "AI receptionist vs virtual receptionist: the practical UK comparison",
    canonicalPath: "/ai-receptionist-vs-virtual-receptionist",
    articleSection: "AI receptionist comparisons",
    datePublished: "2026-06-14",
    dateModified: "2026-06-14",
    intro: [
      `A virtual receptionist and an AI receptionist can both make a small business feel more responsive. They can help when the owner is on site, the team is busy with customers, or enquiries arrive outside normal hours. The names sound similar, but the operating model is very different.`,
      `A virtual receptionist is normally a real person working remotely. An AI receptionist is software that handles the structured first step of an enquiry. One gives you human call handling without employing in-house reception. The other gives you always-on intake, lead capture, and follow-up support without needing a person to answer every routine request.`,
      `This guide compares the two options for UK businesses that want fewer missed calls, faster follow-up, and a cleaner way to manage new leads. It explains where a virtual receptionist is stronger, where AI is stronger, how pricing differs, and how to decide which option fits your current stage.`,
    ],
    sections: [
      {
        id: "what-they-are",
        eyebrow: "Basics",
        title: "What is a virtual receptionist and what is an AI receptionist?",
        paragraphs: [
          `A virtual receptionist is a remote human receptionist who answers calls or handles admin for your business. The service may be provided by an agency, call centre, freelancer, or specialist reception company. They can take messages, book appointments, transfer calls, answer simple questions, and give your business a more professional front line.`,
          `An AI receptionist is software that captures and organises enquiries. It may work through a website widget, missed call flow, chat interface, or structured intake form. Instead of every request needing a person, the AI asks clear questions, records details, answers safe common queries, and passes the enquiry to your team for action.`,
          `The key distinction is not whether one is modern and one is old-fashioned. The key distinction is capacity. Virtual receptionists offer human time. AI receptionists offer repeatable workflow automation. If your biggest problem is that too many simple enquiries wait for a human, AI may be a better starting point. If every interaction needs judgement and warmth, a virtual receptionist may be worth the extra operational cost.`,
        ],
        bullets: [
          "Virtual receptionists are people working remotely on your behalf.",
          "AI receptionists are software flows that capture, structure, and route requests.",
          "Virtual reception is strongest for nuanced human conversation.",
          "AI reception is strongest for always-on structured intake and follow-up organisation.",
        ],
      },
      {
        id: "availability",
        eyebrow: "Availability",
        title: "Availability, speed, and missed enquiries",
        paragraphs: [
          `Many UK businesses lose enquiries because the team is simply unavailable at the moment a customer reaches out. A builder may be on a site visit, a garage owner may be in the workshop, an estate agent may be at a viewing, and a clinic receptionist may be helping someone at the desk. The customer does not always wait.`,
          `A virtual receptionist can extend coverage beyond what an in-house team can manage. That is valuable when live calls are important and the business wants a human answer. However, availability may still depend on package hours, operator capacity, call overflow rules, and whether the service supports evenings or weekends at an acceptable price.`,
          `An AI receptionist is always available for the structured first step. It does not become busy because three people ask questions at once. It can capture details after hours, on weekends, and during peak periods. That does not mean it replaces the team. It means the team arrives later to a clearer list of captured requests rather than a trail of missed calls and vague messages.`,
          `For many small businesses, the biggest improvement is not instant conversation; it is instant capture. If a customer can leave their details, explain what they need, and know the request has been received, the business has a better chance of following up before the opportunity goes cold.`,
        ],
      },
      {
        id: "quality",
        eyebrow: "Quality",
        title: "Customer experience and quality control",
        paragraphs: [
          `A strong virtual receptionist can sound natural, adapt to a caller, and represent the business well. That can be especially helpful when callers are worried, confused, elderly, upset, or asking questions that do not fit a neat form. A human can pause, reassure, and clarify in a way software should not try to imitate.`,
          `Quality can vary, though. If the virtual receptionist does not know your business well, they may take a message but miss useful context. If the provider changes operators frequently, the customer experience may be inconsistent. If scripts are too rigid, the call may still feel like a call centre rather than your business.`,
          `An AI receptionist creates quality through consistency. It asks the same core questions, captures the same fields, and avoids going beyond its designed role. A good AI flow should make clear that staff will review the request. It should not pretend to be a human, invent answers, or give advice in areas where a professional should decide.`,
          `LeadClaw is designed around that boundary. It helps with enquiry capture, missed call recovery, lead tracking, and follow-up. Your team remains responsible for quoting, diagnosis, treatment advice, complaints, negotiation, and final decisions. That is often the safest and most practical split between automation and people.`,
        ],
        bullets: [
          "Use human reception for emotional, sensitive, or judgement-heavy conversations.",
          "Use AI reception for repeatable intake, routing, and follow-up reminders.",
          "Make automation transparent so customers understand what happens next.",
          "Keep staff in control of advice, commitments, prices, and exceptions.",
        ],
      },
      {
        id: "pricing",
        eyebrow: "Cost",
        title: "Pricing and budget control",
        paragraphs: [
          `Virtual receptionist pricing usually reflects human labour. Plans may depend on minutes, number of calls, hours of coverage, appointment booking features, diary access, transfers, and call complexity. That can be sensible, but it may also create variable monthly costs when demand changes.`,
          `AI receptionist pricing is usually closer to software pricing. The product may charge a fixed monthly fee, usage allowance, conversation limit, or plan tier. This can make budgeting simpler for small businesses that need reliable capture but are not ready to pay for a person to handle every interaction.`,
          `The right comparison should include the work after the call. If a virtual receptionist emails call notes and staff still manually update spreadsheets, chase replies, and reconcile messages across channels, the business may still carry a large admin load. If an AI receptionist captures requests into a shared workspace, the value includes organisation as well as first response.`,
          `LeadClaw keeps the choice visible with public pricing and a free trial. The pricing page explains the plans, while the free trial lets a business test whether automated intake and follow-up support improve the real workflow. That is often safer than committing to a larger reception package before the enquiry process is clear.`,
        ],
      },
      {
        id: "workflows",
        eyebrow: "Workflow",
        title: "How each option fits into daily operations",
        paragraphs: [
          `A virtual receptionist fits best when phone calls are the main channel and the business wants another person to answer, reassure, and route them. It can be especially useful for appointment-led services, professional firms, and high-value businesses that want a human front line but cannot justify in-house reception.`,
          `An AI receptionist fits best when enquiries arrive from several places and need to be made visible. A small business may have calls, website forms, email, Facebook messages, Google Business Profile enquiries, and direct messages. Even if only some of those are automated in the first phase, a shared lead tracker can reduce the sense of chaos.`,
          `The operational advantage of AI is repeatability. A plumber can collect job type, postcode, urgency, and access details. An estate agent can collect valuation interest, property type, location, and preferred contact time. A garage can collect MOT date, registration, service type, and preferred dates. Each business can start with a predictable intake shape.`,
          `The operational advantage of a person is flexibility. If a caller changes topic, becomes upset, or needs a nuanced conversation, a human can handle the moment. That is why the strongest setup may use AI for simple capture and people for higher-value or sensitive interactions.`,
        ],
      },
      {
        id: "examples",
        eyebrow: "Examples",
        title: "UK business examples",
        paragraphs: [
          `A heating engineer may receive urgent boiler enquiries during jobs and after hours. A virtual receptionist can answer and take a message, but an AI receptionist can also collect postcode, boiler issue, urgency, and preferred callback time when the call is missed or when the website visitor is browsing late at night.`,
          `A private clinic may need human sensitivity for some calls, but still benefit from AI intake for administrative requests. The AI can collect appointment interest, contact details, and preferred times, while avoiding clinical advice. Staff review the request and decide the appropriate next step.`,
          `An estate agency may care about lead response speed for valuation requests and viewing enquiries. A virtual receptionist can help during business hours, but an AI receptionist can capture evening and weekend website visitors. This gives the negotiators a clearer list to work through instead of relying on voicemail and inbox searches.`,
          `A garage may not need a human to answer every routine MOT or service question. It may need a structured way to collect vehicle details and contact preferences. AI reception can reduce the admin gap between customer intent and workshop follow-up, while the team still confirms bookings and prices.`,
        ],
      },
      {
        id: "hybrid",
        eyebrow: "Decision",
        title: "Should you use AI, a virtual receptionist, or both?",
        paragraphs: [
          `Use a virtual receptionist if your callers expect a person, your calls are highly nuanced, or the first conversation often requires judgement. The service may cost more than software, but it can be worth it when the customer experience depends on human tone from the first word.`,
          `Use an AI receptionist if your main problem is missed enquiries, repetitive questions, slow callbacks, after-hours website visitors, scattered lead notes, or inconsistent follow-up. AI is often the quickest way to create a reliable capture layer before investing in more human admin.`,
          `Use both if your business has a mix of high-value human calls and a large volume of routine enquiries. The virtual receptionist can answer selected live calls, while AI handles website capture, missed call recovery, and structured follow-up support. That can be a strong hybrid model if the handover is planned carefully.`,
          `If you are not sure, start with the smallest test that gives you evidence. LeadClaw can be trialled without a card, so you can see whether a structured AI receptionist improves the way your business captures and follows up on real enquiries. From there, you can decide whether human virtual reception is still needed.`,
        ],
        bullets: [
          "Start with the channel where you lose the most enquiries.",
          "Map what information staff need before they can follow up.",
          "Keep human review for decisions and exceptions.",
          "Trial the workflow before committing to a larger monthly service.",
        ],
      },
    ],
    faqHeading: "AI receptionist vs virtual receptionist FAQ",
    faq: [
      {
        question: "Is a virtual receptionist better than AI?",
        answer:
          "A virtual receptionist is better when the first interaction needs a human. AI is better when the business needs always-on structured intake, missed call recovery, and consistent follow-up organisation.",
      },
      {
        question: "Can an AI receptionist sound human?",
        answer:
          "It can be polite and natural, but it should not pretend to be a person. The safest experience is transparent, helpful, and clear about when staff will follow up.",
      },
      {
        question: "Do I need both options?",
        answer:
          "Some businesses benefit from both. Human virtual reception can handle sensitive or high-value calls, while AI captures routine website and missed-call enquiries.",
      },
      {
        question: "Is LeadClaw a virtual receptionist?",
        answer:
          "LeadClaw is AI receptionist and workflow automation software. It helps capture enquiries, organise leads, and support follow-up, while your team stays in control of decisions.",
      },
      {
        question: "Can I test LeadClaw before replacing my current reception setup?",
        answer:
          "Yes. LeadClaw offers a free trial so you can test the workflow before changing a live reception process.",
      },
    ],
    relatedLinks: [
      { href: "/ai-receptionist-vs-answering-service", label: "AI receptionist vs answering service" },
      { href: "/how-much-does-an-answering-service-cost-uk", label: "Answering service costs UK" },
      { href: "/missed-call-statistics-uk", label: "Missed call statistics UK" },
      ...coreRelatedLinks,
    ],
  },
  {
    slug: "how-much-does-an-answering-service-cost-uk",
    badge: "Pricing guide",
    title: "How Much Does an Answering Service Cost in the UK? | LeadClaw",
    metaDescription:
      "A practical UK guide to answering service costs, pricing models, hidden fees, AI receptionist alternatives, and how to compare value for missed calls.",
    h1: "How much does an answering service cost in the UK?",
    canonicalPath: "/how-much-does-an-answering-service-cost-uk",
    articleSection: "Reception pricing guides",
    datePublished: "2026-06-14",
    dateModified: "2026-06-14",
    intro: [
      `Answering service costs in the UK vary because providers sell different levels of human call handling. Some packages are designed for simple message taking. Others include diary management, live transfers, overflow reception, extended hours, appointment booking, and sector-specific scripts. That makes headline prices difficult to compare without understanding what is included.`,
      `The most useful way to think about cost is not only what you pay the provider. It is what missed calls, slow callbacks, and messy handover are already costing the business. A service that answers calls but leaves follow-up scattered may be cheaper on paper and still expensive operationally. A software option that captures requests consistently may solve more of the workflow for a smaller monthly commitment.`,
      `This guide explains the main UK answering service pricing models, the fees to watch for, how AI receptionists compare, and how businesses can calculate whether LeadClaw or a human answering service is the better first investment.`,
    ],
    sections: [
      {
        id: "pricing-models",
        eyebrow: "Models",
        title: "Common answering service pricing models",
        paragraphs: [
          `Most answering services charge in a way that reflects human time. A provider has to staff operators, train them, manage call routing, maintain scripts, and provide reporting. Because of that, pricing may be based on minutes, call volume, a monthly package, pay-as-you-go usage, opening hours, or a combination of these.`,
          `A minute-based plan charges for the time operators spend on your calls. This can work well if calls are predictable and short. The risk is that longer calls, repeated basic questions, or unexpected spikes can increase the bill. A call-based plan charges by the number of calls handled, which is easier to understand but may still include fair usage rules or limits.`,
          `Some services sell bundled packages. A small package might include a fixed number of calls or minutes, while higher tiers include diary access, call transfers, booking support, or longer hours. Package pricing can be attractive because it is predictable, but only if the included capacity matches your real enquiry pattern.`,
          `Other providers quote custom pricing for businesses with complex requirements. That may be appropriate for legal firms, medical practices, agencies, or multi-location businesses. For a small local service business, custom pricing may be more service than is needed if the core problem is simply capturing missed calls and website requests.`,
        ],
        bullets: [
          "Minute-based pricing can rise when calls are longer than expected.",
          "Call-based pricing is simple but may include usage limits.",
          "Monthly packages can be predictable if the allowance fits your volume.",
          "Custom pricing may be useful for complex reception workflows.",
        ],
      },
      {
        id: "what-affects-cost",
        eyebrow: "Drivers",
        title: "What affects the monthly cost?",
        paragraphs: [
          `The biggest cost drivers are call volume, call length, opening hours, operator complexity, and the handover process. A simple message-taking service costs less than a provider that answers detailed questions, accesses calendars, books appointments, transfers calls, filters urgent issues, and follows a detailed script.`,
          `Hours of coverage matter. Standard weekday cover may cost less than evening, weekend, bank holiday, or 24/7 support. This is one reason small businesses often compare answering services with AI receptionists. Many missed enquiries happen outside normal hours, but paying for human coverage at all those times may not be proportionate.`,
          `Complexity also matters. If the operator needs to understand multiple services, locations, staff calendars, pricing rules, urgent escalation paths, and sector-specific wording, setup and ongoing costs may increase. The business also needs to maintain those scripts whenever services, prices, or availability change.`,
          `Finally, handover affects cost indirectly. If call notes are delivered in a way that creates more admin, the provider cost is only part of the total. Staff may still need to copy details into a CRM, chase missing information, update spreadsheets, and decide which enquiries are still open. That hidden internal time should be included in the comparison.`,
        ],
      },
      {
        id: "hidden-fees",
        eyebrow: "Watch-outs",
        title: "Hidden costs and questions to ask",
        paragraphs: [
          `A transparent provider should make it easy to understand the real monthly commitment. Before choosing an answering service, ask what happens when you exceed the allowance, whether transfers are charged differently, whether spam or wrong-number calls count, and how long call notes are stored.`,
          `Ask whether setup, script changes, calendar integrations, call recording, reporting, bilingual handling, out-of-hours routing, or emergency escalation cost extra. Some of these add-ons may be worth paying for, but they should be part of the comparison from the beginning. Surprises create frustration later.`,
          `Also ask about cancellation and data ownership. A business should be able to understand how quickly it can leave, how customer data is handled, and whether suppression or opt-out requests are recorded properly. Even simple message taking involves personal information, so privacy and process matter.`,
          `The same questions apply to software. AI receptionist pricing should make clear what is included, what counts as usage, how leads are stored, and what support is available. LeadClaw keeps this simple by explaining plans publicly and letting businesses try the workflow before making a longer decision.`,
        ],
        bullets: [
          "Ask whether missed calls, transfers, spam calls, and long calls are billed differently.",
          "Check setup, script, calendar, and reporting fees.",
          "Confirm how customer data and opt-out requests are handled.",
          "Review cancellation terms before depending on the service.",
        ],
      },
      {
        id: "ai-comparison",
        eyebrow: "Alternative",
        title: "How AI receptionist pricing compares",
        paragraphs: [
          `AI receptionist software is not priced around operator time in the same way. The provider still has infrastructure, support, and product development costs, but one extra routine enquiry does not require another human to answer live. This can make AI reception more scalable for repetitive intake and after-hours capture.`,
          `The trade-off is that AI should not handle everything. A software flow is not a human receptionist, adviser, clinician, engineer, solicitor, negotiator, or complaints handler. It is best used for safe, structured admin: collecting details, answering common non-sensitive questions, routing requests, and prompting follow-up.`,
          `Because of that, AI receptionist value should be judged by the workflow it improves. Does it capture enquiries that used to be missed? Does it reduce time spent copying notes? Does it make callback lists clearer? Does it help staff see which leads are waiting? Does it give customers a more confident first step than voicemail?`,
          `LeadClaw is designed around those practical outcomes. It combines AI receptionist intake with lead tracking and follow-up support. For a business that does not need every first interaction to be human, that can be a lower-friction way to improve response speed before paying for a full answering service.`,
        ],
      },
      {
        id: "business-examples",
        eyebrow: "Examples",
        title: "Cost examples by type of UK business",
        paragraphs: [
          `A plumbing or heating business may not need a person to answer every routine enquiry. It needs to know the problem, postcode, urgency, customer details, and preferred callback time. AI reception can collect that information when the engineer is on a job, while urgent escalation rules can still be handled by the business.`,
          `A dental practice or clinic may prefer human handling for certain calls but still use AI for website intake and after-hours appointment interest. The cost comparison should separate sensitive conversations from routine admin. Paying a human for every repeated opening-hours question may be unnecessary if software can handle safe capture.`,
          `A garage may receive predictable enquiries about MOT bookings, servicing, repairs, diagnostics, and vehicle details. A human answering service can take messages, but an AI receptionist can reduce the admin load by collecting structured information and creating a visible list for the workshop team.`,
          `An estate agent may benefit from fast capture of valuation and viewing requests. If the agency needs a polished human conversation for premium instructions, virtual or answering support may help. If the main issue is evening website visitors leaving without a response, AI reception may be the simpler first step.`,
        ],
      },
      {
        id: "roi",
        eyebrow: "Value",
        title: "How to calculate whether the cost is worth it",
        paragraphs: [
          `Start with missed enquiries. Count how many calls, forms, and messages were not handled quickly in a normal week. Then estimate how many of those were real opportunities. This does not need to be perfect. Even a conservative estimate can show whether reception support is solving a meaningful problem or merely adding another monthly expense.`,
          `Next, estimate the value of one recovered enquiry. For a tradesperson, it might be a callout, repair, installation, or quote. For a garage, it might be an MOT or service booking. For an estate agent, it might be a valuation lead. For a clinic, it might be a consultation request. Compare that value with the monthly cost of the service.`,
          `Then include admin time. If staff spend hours each week copying call notes, checking inboxes, chasing missing details, and trying to remember who needs a callback, that time has a cost. A system that reduces that friction may be valuable even before counting extra revenue.`,
          `Finally, measure speed. A receptionist solution should shorten the time between customer intent and business response. Whether you use humans, AI, or both, the goal is not to create a prettier message-taking process. It is to make sure customers can move to the next step while they are still interested.`,
        ],
        bullets: [
          "Track missed calls and unanswered web requests for a full week.",
          "Estimate the value of one realistic recovered booking or quote.",
          "Include internal admin time, not only provider fees.",
          "Review whether response speed improves after implementation.",
        ],
      },
      {
        id: "choose",
        eyebrow: "Decision",
        title: "How to choose between an answering service and LeadClaw",
        paragraphs: [
          `Choose an answering service if your business needs a human to answer calls live, calm customers, transfer urgent calls, or manage conversations that do not fit a predictable intake flow. The extra cost can be worthwhile when the first conversation itself is the product experience.`,
          `Choose LeadClaw if the immediate problem is missed call recovery, website enquiry capture, follow-up visibility, and repetitive admin. It is especially useful for small teams that cannot monitor every channel all day but still want customers to receive a clear first response.`,
          `A sensible first step is to trial the lowest-risk option. If your business has no structured lead capture today, software can provide useful evidence quickly. If the trial shows that many enquiries are still too complex for automation, you can add human answering support with a clearer understanding of what should be escalated.`,
          `You can compare LeadClaw plans on the pricing page, review the broader comparison page, or start a free trial. The best reception setup is the one your team will actually use, maintain, and trust during a busy week.`,
        ],
      },
    ],
    faqHeading: "Answering service cost UK FAQ",
    faq: [
      {
        question: "How much does an answering service cost in the UK?",
        answer:
          "Costs vary by provider, call volume, minutes, hours of coverage, and service complexity. Message-taking plans are usually cheaper than services with booking, transfers, extended hours, or detailed scripts.",
      },
      {
        question: "Is an AI receptionist cheaper than an answering service?",
        answer:
          "It can be cheaper for routine enquiry capture because it is software based rather than staffed by human operators. The right comparison depends on whether your calls need a person or simply need reliable intake and follow-up.",
      },
      {
        question: "What hidden answering service fees should I check?",
        answer:
          "Check extra charges for exceeding allowances, long calls, transfers, setup, script changes, calendar access, out-of-hours cover, reporting, and cancellation.",
      },
      {
        question: "Can LeadClaw replace an answering service?",
        answer:
          "LeadClaw can replace some routine capture and follow-up work, but it should not replace human handling for sensitive, complex, or judgement-heavy conversations.",
      },
      {
        question: "How do I compare reception options fairly?",
        answer:
          "Compare the full workflow: first response, detail capture, handover, follow-up visibility, admin time, monthly cost, and whether the setup helps recover real enquiries.",
      },
    ],
    relatedLinks: [
      { href: "/ai-receptionist-vs-answering-service", label: "AI receptionist vs answering service" },
      { href: "/ai-receptionist-vs-virtual-receptionist", label: "AI receptionist vs virtual receptionist" },
      { href: "/missed-call-statistics-uk", label: "Missed call statistics UK" },
      ...coreRelatedLinks,
    ],
  },
  {
    slug: "missed-call-statistics-uk",
    badge: "Operations guide",
    title: "Missed Call Statistics UK: What Businesses Should Track | LeadClaw",
    metaDescription:
      "A practical guide to missed call statistics for UK businesses: missed-call rate, callback speed, after-hours demand, lead value, and how AI reception helps.",
    h1: "Missed call statistics UK businesses should track",
    canonicalPath: "/missed-call-statistics-uk",
    articleSection: "Missed call recovery",
    datePublished: "2026-06-14",
    dateModified: "2026-06-14",
    intro: [
      `Missed call statistics are useful because they turn a vague feeling into an operational signal. Most small businesses know they miss calls sometimes. Fewer know how often it happens, which calls matter, how quickly the team calls back, how many enquiries arrive after hours, and how much potential work sits behind the missed-call pattern.`,
      `This guide is written for UK service businesses that want a practical way to measure missed calls without building a call centre reporting stack. It avoids dramatic claims and focuses on numbers you can track yourself: missed-call rate, callback time, contact rate, booking rate, source, service type, after-hours share, and revenue at risk.`,
      `Once those statistics are visible, the solution becomes easier to choose. Some businesses need a human answering service. Others need an AI receptionist that captures the request, asks the right questions, and keeps follow-up moving. LeadClaw is built for the second problem: turning missed calls and website enquiries into organised requests your team can action.`,
    ],
    sections: [
      {
        id: "why-track",
        eyebrow: "Why it matters",
        title: "Why missed calls deserve measurement",
        paragraphs: [
          `A missed call is not always a lost sale. Some calls are spam, wrong numbers, suppliers, repeat customers, or non-urgent questions. The problem is that high-intent enquiries are mixed into the same list. Without tracking, a business cannot tell whether missed calls are a minor irritation or a serious revenue leak.`,
          `For service businesses, timing matters. A customer looking for a plumber, electrician, roofer, garage, estate agent, clinic, or accountant may contact several providers. If one business responds quickly and another waits until the next day, the faster business often feels safer. The missed call becomes a speed problem, not only a phone problem.`,
          `Statistics help you separate emotion from evidence. Instead of saying the phone is a nightmare, you can see that Mondays between 8am and 10am are overloaded, or that after-hours website visitors need a clearer route, or that quote requests are being missed while the team is on site. That evidence leads to better decisions.`,
          `LeadClaw helps because it gives customers another route to leave useful details. The aim is not to shame the team for missing calls. Small businesses are busy. The aim is to create a system where customer intent is captured even when no one is free to answer live.`,
        ],
      },
      {
        id: "core-metrics",
        eyebrow: "Metrics",
        title: "The core missed-call statistics to track",
        paragraphs: [
          `The first metric is missed-call rate. This is the number of missed calls divided by total inbound calls for a chosen period. Track it weekly rather than obsessing over one day. A single busy afternoon may be unusual, but a repeated weekly pattern tells you where coverage is weak.`,
          `The second metric is callback time. Measure how long it takes for a real person to attempt contact after a missed call. The average is useful, but the longest delays matter too. A handful of very slow callbacks may reveal a handover issue, especially if calls are missed late in the day and forgotten overnight.`,
          `The third metric is successful contact rate. Calling back is not the same as reaching the customer. If many callbacks go unanswered, the business may need a text, email, or AI follow-up path that captures details while the customer is still interested. This is where missed call recovery can make the process less fragile.`,
          `The fourth metric is conversion or booking rate from missed calls. This is harder to track, but it is the most commercially meaningful number. How many missed-call leads became booked work, quotes, consultations, viewings, MOTs, or appointments? Even a rough weekly count is better than guessing.`,
        ],
        bullets: [
          "Missed-call rate: missed inbound calls divided by total inbound calls.",
          "Callback time: how long it takes to respond after the missed call.",
          "Successful contact rate: how often the customer is actually reached.",
          "Booking rate: how many missed-call enquiries become real opportunities.",
        ],
      },
      {
        id: "after-hours",
        eyebrow: "Timing",
        title: "After-hours and peak-time patterns",
        paragraphs: [
          `After-hours demand is easy to underestimate. Many customers search for services after work, during weekends, or when an urgent problem appears outside normal office hours. They may not expect a full answer instantly, but they often expect a simple way to leave details and feel that the request has landed.`,
          `Track how many missed calls and website enquiries happen outside your normal working hours. Then split them by service type where possible. A heating engineer may see urgent boiler requests in the evening. An estate agent may see valuation research on Sundays. A garage may see MOT booking interest after customers check their diaries at home.`,
          `Peak-time patterns matter too. If most missed calls happen at 9am, lunchtime, school pickup, or late afternoon, the problem may be scheduling rather than demand. The business might need a different callback routine, a clearer website intake path, or an AI receptionist that captures routine details when staff are predictably unavailable.`,
          `Once timing is visible, the fix can be proportionate. A business may not need a full-time receptionist. It may need better capture during two busy windows. It may not need 24/7 human answering. It may need after-hours intake that gives the morning team a structured list of real requests.`,
        ],
      },
      {
        id: "lead-value",
        eyebrow: "Value",
        title: "Estimating revenue at risk without exaggeration",
        paragraphs: [
          `Revenue at risk is an estimate, not a guarantee. The safest way to calculate it is to stay conservative. Count only missed calls that look like real enquiries. Apply a realistic conversion rate based on your own history. Use the average value of a normal job, booking, quote, consultation, or appointment, not an unusually high-value example.`,
          `For example, imagine a business identifies 20 missed calls in a week, decides that 8 were likely real enquiries, reaches 4 of them, and wins 2 jobs. The opportunity is not automatically all 20 calls. The useful statistic is that half of the likely enquiries were not reached. That tells the team where follow-up and capture need improvement.`,
          `A better estimate becomes possible over time. Label missed calls by outcome: spam, existing customer, supplier, quote request, booking request, urgent job, wrong area, duplicate, or unknown. After a few weeks, the business can see which missed-call types are worth prioritising and which are noise.`,
          `LeadClaw can support this kind of thinking by turning calls and website requests into tracked enquiries. The point is not to promise guaranteed revenue. The point is to make the missed-call pipeline visible enough that staff can make better follow-up decisions.`,
        ],
        bullets: [
          "Use conservative assumptions when estimating revenue at risk.",
          "Separate real enquiries from spam, suppliers, and wrong numbers.",
          "Track outcomes so the estimate improves over time.",
          "Focus on better follow-up, not exaggerated headline numbers.",
        ],
      },
      {
        id: "industry-examples",
        eyebrow: "Examples",
        title: "Missed-call patterns by UK business type",
        paragraphs: [
          `Trades often miss calls because the person who can answer is also the person doing the work. Builders, plumbers, electricians, roofers, and heating engineers may be on ladders, in vans, in lofts, under floors, or speaking to existing customers. The best missed-call statistic for these businesses is usually response time by urgency and postcode.`,
          `Garages often miss calls during workshop hours. Staff may be handling vehicles, parts, diagnostics, MOTs, and customers at the counter. The useful statistics are missed calls by service type, successful callback rate, and how many callers still booked after a delayed response. Structured intake can collect registration, service need, and preferred dates before staff call back.`,
          `Estate agents often care about speed for valuation requests, viewing enquiries, and landlord calls. Missed-call statistics should distinguish sellers, buyers, landlords, tenants, and general admin. The commercial value of one missed valuation request can be very different from a low-priority admin call.`,
          `Clinics and appointment-led businesses need careful boundaries. Missed-call tracking can show appointment interest, callback requests, and common admin questions, but staff should still handle advice and suitability. AI receptionist intake should collect administrative context and route the request rather than making clinical claims or decisions.`,
        ],
      },
      {
        id: "tracking-process",
        eyebrow: "Process",
        title: "How to set up missed-call tracking",
        paragraphs: [
          `Start simple. Export call logs if your phone system allows it, or record missed calls manually for two weeks. Track date, time, caller number, whether a callback happened, callback time, whether contact was made, what the caller wanted, and the outcome. This is enough to find patterns without overbuilding the reporting process.`,
          `Next, connect website enquiries to the same view. A missed call is only one version of missed intent. A customer may also abandon a web form, use a chat widget, reply to an old email, or send a social message. The more scattered the channels are, the harder it is to know whether follow-up is actually happening.`,
          `Then define a callback routine. Who owns missed calls? How soon should high-priority calls be attempted? What happens if the customer does not answer? When should a text or email be sent? What details should be collected before staff spend time chasing? A statistic is only useful if it changes behaviour.`,
          `LeadClaw gives businesses a practical way to start this without building a custom CRM. It captures requests, supports follow-up, and keeps leads visible. That makes missed-call recovery part of the daily workflow rather than a separate spreadsheet that quickly goes stale.`,
        ],
      },
      {
        id: "ai-receptionist-role",
        eyebrow: "Automation",
        title: "How an AI receptionist helps missed-call recovery",
        paragraphs: [
          `An AI receptionist helps by giving customers a route when the team is unavailable. Instead of waiting for voicemail or giving up, the customer can leave structured details. The AI can ask safe questions, confirm the request has been received, and make the next step clearer.`,
          `The second benefit is internal visibility. A missed-call recovery flow should not only notify someone that a call was missed. It should create an enquiry that can be tracked. Staff should be able to see what needs attention, what has been handled, and what still needs a response.`,
          `The third benefit is consistency. Small teams are rarely short of effort. They are short of time and reliable handover. An AI receptionist can ask the same core questions every time, even when the team is dealing with another customer. That creates a cleaner starting point for follow-up.`,
          `LeadClaw is built for this use case. It helps businesses capture enquiries, organise operational work, automate follow-ups, and reduce repetitive admin. If your missed-call statistics show that customers are slipping through predictable gaps, the next step is to test whether a structured AI workflow improves the numbers.`,
        ],
      },
      {
        id: "mistakes",
        eyebrow: "Cautions",
        title: "Common mistakes when reading missed-call statistics",
        paragraphs: [
          `The first mistake is treating every missed call as lost revenue. That creates inflated numbers and poor decisions. Some missed calls are not prospects. Some would never have converted. Some are duplicates. A responsible missed-call process separates signal from noise.`,
          `The second mistake is tracking calls without tracking outcomes. A lower missed-call rate is good, but it does not prove the business is winning more work. Track whether callers were reached, whether they booked, whether they were a fit, and whether the team followed up within the agreed time.`,
          `The third mistake is buying a tool before defining the handover. Technology cannot fix an unclear owner. If no one is responsible for reviewing new enquiries, even the best capture system will become another inbox. Decide the owner, the response window, and the fallback before judging the software.`,
          `The fourth mistake is ignoring website enquiries. Many customers do not call first. They browse, compare, hesitate, and submit a form if the path is easy. A missed-call strategy should sit alongside website intake, pricing clarity, and follow-up automation. That is where LeadClaw is designed to help.`,
        ],
      },
    ],
    faqHeading: "Missed call statistics UK FAQ",
    faq: [
      {
        question: "What missed-call statistics should a UK business track first?",
        answer:
          "Start with missed-call rate, callback time, successful contact rate, after-hours share, service type, and whether the missed call became a booking, quote, appointment, or closed opportunity.",
      },
      {
        question: "How do I calculate missed-call rate?",
        answer:
          "Divide missed inbound calls by total inbound calls for the period you are measuring. Track weekly patterns so one unusual day does not distort the picture.",
      },
      {
        question: "Are all missed calls lost revenue?",
        answer:
          "No. Some missed calls are spam, duplicates, suppliers, or low-fit enquiries. Estimate conservatively by separating likely real enquiries from noise and tracking outcomes over time.",
      },
      {
        question: "Can an AI receptionist reduce missed calls?",
        answer:
          "It can reduce missed opportunities by giving customers a structured way to leave details when staff are unavailable. It does not replace every human call, but it can improve capture and follow-up.",
      },
      {
        question: "How does LeadClaw help with missed-call recovery?",
        answer:
          "LeadClaw captures requests, organises leads in a workspace, supports follow-up, and helps staff see which enquiries still need attention.",
      },
    ],
    relatedLinks: [
      { href: "/ai-receptionist-vs-answering-service", label: "AI receptionist vs answering service" },
      { href: "/ai-receptionist-vs-virtual-receptionist", label: "AI receptionist vs virtual receptionist" },
      { href: "/how-much-does-an-answering-service-cost-uk", label: "Answering service costs UK" },
      ...coreRelatedLinks,
    ],
  },
];

export function getSeoArticlePage(slug: string): SeoArticlePage {
  const page = seoArticlePages.find((item) => item.slug === slug);

  if (!page) {
    throw new Error(`Unknown SEO article page: ${slug}`);
  }

  return page;
}

export function buildSeoArticleMetadata(page: SeoArticlePage): Metadata {
  const url = `${siteUrl}${page.canonicalPath}`;

  return {
    title: page.title,
    description: page.metaDescription,
    alternates: {
      canonical: page.canonicalPath,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      type: "article",
      url,
      siteName: "LeadClaw",
      title: page.title,
      description: page.metaDescription,
      publishedTime: page.datePublished,
      modifiedTime: page.dateModified,
      authors: ["LeadClaw"],
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: "LeadClaw AI receptionist software",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.metaDescription,
      images: [ogImage],
    },
  };
}

export function buildSeoArticleJsonLd(page: SeoArticlePage) {
  const url = `${siteUrl}${page.canonicalPath}`;

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.h1,
    description: page.metaDescription,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    articleSection: page.articleSection,
    datePublished: page.datePublished,
    dateModified: page.dateModified,
    author: {
      "@type": "Organization",
      name: "LeadClaw",
      url: siteUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "LeadClaw",
      url: siteUrl,
    },
    image: [`${siteUrl}${ogImage}`],
  };
}

export function buildSeoArticleFaqJsonLd(page: SeoArticlePage) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
