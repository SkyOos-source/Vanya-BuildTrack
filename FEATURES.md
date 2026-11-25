# Vanya BuildTrack — Product Features

## Product overview

Vanya BuildTrack is a construction project management SaaS application for owners, site engineers, and clients. It brings project and site administration, field updates, quotations, expenses, attendance, and client communication into one responsive workspace.

## User portals

### 1. Owner portal

Owners manage their organization, projects, people, finances, and overall construction progress.

- **Dashboard and project overview**
  - Summarize active projects, sites, recent activity, pending approvals, and progress.
  - Provide project-wise views of updates, expenses, materials, attendance, and reports.
- **Project and site management**
  - Create, edit, archive, and manage construction projects.
  - Create and manage multiple construction sites within projects.
  - Add clients and assign them to projects.
  - Add site engineers and assign them to projects and sites.
- **Materials and expenses**
  - Track construction materials received, used, and remaining by project or site.
  - Assign material quantities to project engineers, track usage against each balance, and approve or decline requests for additional materials.
  - Assign spending funds to site engineers and track each allocation's spent and remaining balance, including negative balances when spending exceeds assigned funds.
  - Log project expenses with descriptions and receipt or photo attachments; only logged expenses count toward project expenditure and profit.
  - Review engineers' requests for additional funds separately from logged spending.
  - View project-wise expense reports.
- **Project payments**
  - Record cash or online payments against a project and review the total and payment history.
  - Require an image of the payment confirmation for online payments.
  - See whether each payment was recorded by the owner or client.
  - Provide dedicated Payments pages in the owner and client portals, with project filters and cash/online totals.
  - Show payment progress as a percentage of the project quotation, capped at 100%.
- **Attendance and progress**
  - Review worker and engineer attendance.
  - Monitor construction progress updates and photos submitted from sites.
- **Client work requests**
  - Review client requests for additional project work and their attached photos.
  - Approve or decline a request; assigned site engineers and project managers can also review requests for their projects.
- **Quotations and additional work**
  - Upload quotations and assign them to clients.
  - Create and manage quotations for additional or add-on work.
  - Track quotation status, including client acceptance or rejection.
- **Communication**
  - Receive notifications about project activity, submissions, assignments, and quotation updates.
  - Review project activity history.

### 2. Site engineer portal

Site engineers record field activity and keep owners and clients informed.

- View assigned projects and construction sites.
- Submit daily construction progress updates.
- Upload construction progress photos.
- Record the overall project completion percentage and mark start or completion photos. Reaching 100% prompts the site engineer for a completion summary, which is shown in the completion report.
- Log use against owner-assigned material quantities and request additional materials when needed.
- Log expenses against owner-assigned funds even when spending exceeds the remaining balance; show the balance as negative until the owner assigns more funds. Select a project and upload supporting receipts.
- Request additional funds separately when the assigned balance is insufficient.
- Record worker attendance and upload supporting photos.
- View instructions and updates from the owner.
- View submission history for progress, materials, expenses, and attendance.
- Receive notifications about assignments, instructions, and updates.
- Participate in site visits:
  - View assigned or requested site visits.
  - Access visit details and record a visit outcome or notes.
- Review client work requests for assigned projects, including their photos, and approve or decline them.

### 3. Client portal

Clients follow the work on their assigned projects and respond to quotations.

- View assigned construction projects.
- Track construction progress, photos, timelines, and project updates.
- View and download quotations assigned to them.
- Use the Payments page to review and record payments for their assigned project.
- Accept or reject quotations, including quotations for add-on work.
- Request additional work for an assigned project with a description and up to five photos, taken with a device camera or selected from the gallery; track whether the request is approved or declined.
- View approved expense reports.
- Receive notifications about quotations and project updates.
- Submit feedback and reviews about projects or completed site visits.

## Shared features

- Secure login and logout.
- Role-based access for **Owner**, **Site Engineer**, and **Client**.
- User profile management.
- Owner and site engineer profile pages with editable phone numbers, profile photos, and backend-generated QR codes that open shareable public contact details; save a profile to a device's contacts as a vCard.
- Responsive mobile and desktop interface.
- Real-time notifications for relevant project activity.
- Image and document uploads for progress photos, receipts, quotations, and supporting documents.
- Search and filtering across accessible projects, sites, updates, and records.
- Activity history for important project actions and submissions.

## Additional features

### Add-on work and quotations

- Record proposed work that falls outside the original project scope.
- Prepare and upload a quotation for the additional work.
- Assign the quotation to the relevant client and project.
- Track whether the client has accepted or rejected the quotation.
- Keep the quotation and decision in the project activity history.

### Account backup

- Allow an owner to request an export or backup of their account's project and business records.
- Restrict backup access to authorized account owners.
- Make backup availability and completion status visible to the requester.

### Feedback and reviews

- Let clients save a project rating and comment in BuildTrack for the owner, and open the configured Google review page to post it publicly.
- Make received client feedback available to the owner.
- When a project reaches 100% completion, let every role open a report for projects they can access. Include branded report metadata, a completion summary from the final progress update, project and team details, and all photos from the start and completion updates, falling back to the earliest and latest photo updates.
- Let users export the completion report to PDF through the browser's print-to-PDF flow.
- Include a direct Google review link in the client's completion report.

### Engineer site visits

- Allow owners to schedule and assign site visits to engineers.
- Show assigned visit details to the engineer.
- Let engineers record visit notes and relevant photos.
- Make visit updates available to the owner and, where appropriate, the client.

## Access and visibility

- Owners can manage the projects and sites in their account and review related submissions.
- Site engineers can access only the projects, sites, and instructions assigned to them.
- Clients can access only their assigned projects, quotations, approved expense reports, and project updates.
- Clients can view only their own work requests; owners, assigned engineers, and assigned project managers can review requests for their accessible projects.
- Owners and clients can record and view payments only for projects they are authorized to access.
- Users must be authenticated before viewing protected project information or files.

## Product considerations

- Make common field tasks usable on mobile devices, including photo uploads and progress submissions.
- Associate uploaded files with the relevant project and record, and enforce access permissions when viewing or downloading them.
- Keep the status and history of submissions, quotations, and approvals understandable to the users involved.
- Deliver notifications only to users who are permitted to see the associated project or activity.
