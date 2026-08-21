// Queue names, shared between the trigger route and the tasks that declare
// them. A bare constant lives here rather than in a task module so the route
// can reference a queue without importing task code — and with it the Parallel
// client and the service-role client — into its bundle.
//
// The queue and its concurrencyLimit are declared on the task; naming a queue
// when triggering that no task declares leaves runs in PENDING_VERSION.

export const COMPANY_RESEARCH_QUEUE = "company-research";
