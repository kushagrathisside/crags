# CRAGS User Manual

**Compute Resource Allocation and Governance System**

This guide explains how to use CRAGS to request and manage compute resource bookings.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Logging In](#logging-in)
3. [Understanding the Dashboard](#understanding-the-dashboard)
4. [Viewing Compute Systems](#viewing-compute-systems)
5. [Creating a Booking Request](#creating-a-booking-request)
6. [Managing Your Bookings](#managing-your-bookings)
7. [Understanding Booking Status](#understanding-booking-status)
8. [Audit Trail](#audit-trail)
9. [Team Management (Group Leads)](#team-management-group-leads)
10. [Resource Quotas and Limits](#resource-quotas-and-limits)
11. [Troubleshooting](#troubleshooting)

---

## Getting Started

CRAGS is accessible from any web browser. Contact your system administrator for:

- The CRAGS application URL
- Your login credentials (username, email, or password reset link)
- Any proxy or network configuration needed

**Browser Support**: Chrome, Firefox, Safari, Edge (modern versions recommended)

---

## Logging In

1. Open the CRAGS application URL in your browser
2. Click the **Login** button
3. Enter your credentials:
   - **Identifier**: Your username or email
   - **Password**: Your password
4. Click **Login**

If you forget your password, contact your group administrator or system administrator.

### Session Duration

Sessions remain active for 60 minutes of inactivity. You will be logged out automatically and must log back in to continue.

---

## Understanding the Dashboard

After logging in, you arrive at the **Mission Control Dashboard**, which displays:

- **Your Role**: Displays your user role (User, Group Lead, Resource Admin, Super Admin)
- **Group Membership**: Shows your group name and members
- **Quick Stats**: Overview of your recent bookings and resource usage
- **Navigation Tabs**:
  - **Systems**: View and manage compute systems
  - **Bookings**: Request and manage resource bookings
  - **Team** (Group Leads only): Manage group members and quotas
  - **Audit**: View history of all allocation decisions

---

## Viewing Compute Systems

The **Systems** tab displays all available compute resources.

### System Information

Each system shows:

- **System Name**: Identifier for the resource cluster
- **Type**: CPU, GPU, or HYBRID (mixed resources)
- **Available Resources**:
  - CPU cores
  - GPU units
  - RAM (GB)
  - VRAM (GB)

### Filtering Systems

Use the system list to find resources by name or type.

---

## Creating a Booking Request

### Step 1: Navigate to Bookings

Click the **Bookings** tab on the dashboard.

### Step 2: Click "New Booking"

Click the **New Booking** button to open the booking form.

### Step 3: Fill in Booking Details

**System Selection**
- Select the compute system you want to use
- The form displays available capacity

**Time Window**
- **Start Time**: When you need the resources (ISO datetime)
- **End Time**: When you will release the resources
- The system shows available capacity for your chosen time window

**Resource Request**
- **CPU Cores**: Number of CPU cores needed
- **GPU Units**: Number of GPUs needed
- **RAM (GB)**: Amount of RAM in gigabytes
- **VRAM (GB)**: Amount of GPU memory needed

**Workload Type**
- **Foreground**: Interactive, high-priority work
  - Runs immediately if capacity allows
  - Can preempt eligible background jobs
  - Typical use: interactive development, debugging, interactive analysis
- **Background**: Batch processing, lower priority
  - Runs when resources are available
  - Can be preempted by foreground work
  - Typical use: batch training, long-running experiments, data processing

**Project Information**
- **Academic Category**: Research, Teaching, Administration, Other
- **Project Title**: Brief name of your project
- **Expected Deliverable**: What you're producing (paper, model, dataset, etc.)
- **Objective**: What you're trying to accomplish with these resources

### Step 4: Review and Submit

1. Review your booking request
2. Click **Request Booking**
3. The system will either:
   - **Accept** immediately (status: CONFIRMED) if capacity allows
   - **Reject** with detailed explanation if capacity is insufficient

### Important Notes

- **Exact Fit Required**: Your resource request must not exceed available capacity
- **No Partial Allocations**: If GPU units are unavailable, your entire GPU request is rejected
- **Time Windows**: Requests within the exact time window are checked
- **Quota Limits**: Your group's quota limits also affect approval

---

## Managing Your Bookings

### Viewing Bookings

The **Bookings** tab shows all your booking requests.

### Booking Details

Each booking displays:

- **Status**: Current state (REQUESTED, CONFIRMED, CANCELLED, PREEMPTED, COMPLETED, EXPIRED)
- **System**: Which resource cluster
- **Time Window**: Requested dates and times
- **Resources**: CPU, GPU, RAM, VRAM requested
- **Type**: Foreground or background
- **Project Info**: Academic category and project title

### Cancelling a Booking

1. Click the booking you want to cancel
2. Click the **Cancel Booking** button
3. Confirm the cancellation

Cancelled bookings remain visible in your history for audit purposes.

### Filtering and Sorting

Use the filter options to find bookings by:
- System
- Status
- Academic category
- Date range

---

## Understanding Booking Status

| Status | Meaning |
|--------|---------|
| **REQUESTED** | Booking request submitted, awaiting system decision |
| **CONFIRMED** | Request approved; your resources are reserved |
| **CANCELLED** | You cancelled the booking |
| **PREEMPTED** | Your background job was interrupted for a foreground job |
| **COMPLETED** | Booking window ended normally |
| **EXPIRED** | Booking was never actioned and the window passed |

### Status Transitions

```
REQUESTED → CONFIRMED (accepted)
          ↓
          CANCELLED (you cancelled)

CONFIRMED → PREEMPTED (only for background jobs)
          ↓
          CANCELLED (you cancelled or admin cancelled)
          ↓
          COMPLETED (booking window ended normally)
```

### What "PREEMPTED" Means

If your **background** job is preempted:
- A foreground job required your reserved resources
- Your job is stopped and the resources released
- Your booking status changes to PREEMPTED
- You can request the resources again later

(Foreground jobs cannot be preempted.)

---

## Audit Trail

The **Audit** tab logs all system decisions and resource usage.

### What's Recorded

- **Booking Creation**: When and who requested
- **Booking Approval/Rejection**: When decision was made and why
- **Resource Usage**: What resources were actually used
- **Cancellations**: When bookings were cancelled
- **Preemptions**: When background jobs were interrupted

### Interpreting Audit Entries

Each entry shows:

- **Timestamp**: When the event occurred
- **User**: Who initiated the action
- **Action**: What was done (REQUEST, CONFIRM, CANCEL, etc.)
- **Details**: Relevant information (system, resources, reason)

### Why Audit Matters

Audit trails help institutions:
- Understand resource usage patterns
- Ensure fair allocation across groups
- Track research output and impact
- Investigate disputes about bookings

---

## Team Management (Group Leads)

If you are a **Group Lead**, you have additional responsibilities.

### Access Group Management

Click the **Team** tab to manage your group.

### View Group Members

The **Team** tab displays:
- List of group members
- Their roles (User, Group Lead)
- When they joined
- Active projects

### Manage Group Quotas

Group Leads can view (and Resource Admins can modify) group resource quotas:

**Concurrent Quotas** (resources in use at the same time)
- Concurrent CPU cores limit
- Concurrent GPU units limit
- Concurrent RAM (GB) limit
- Concurrent VRAM (GB) limit

**Monthly Quotas** (total usage per calendar month)
- Monthly CPU core-hours
- Monthly GPU core-hours
- Monthly RAM GB-hours
- Monthly VRAM GB-hours

### Group Usage

Click **Usage** to see your group's monthly consumption:
- Current month resource usage
- Percentage of quota used
- Trend compared to previous months

---

## Resource Quotas and Limits

Understanding quotas helps you plan bookings effectively.

### How Quotas Work

**Concurrent Quotas** limit how much your group can use *simultaneously*
- Example: If your group's GPU quota is 4, only 4 GPUs can be in use at once
- Multiple overlapping bookings count toward the concurrent limit
- Non-overlapping bookings do not count toward the concurrent limit

**Monthly Quotas** limit total usage *per calendar month*
- Example: If your group's monthly GPU quota is 500 core-hours, you can use 500 GPU-hours total in the month
- Usage is measured in core-hours: (GPU cores used) × (hours booked)
- Once quota is exceeded, no new bookings are approved until the next month

### Checking Your Quota Status

1. Open the **Team** tab (if you're a Group Lead)
2. View current month usage
3. Compare against your group's quotas
4. Plan future bookings accordingly

### What Happens When Quota is Exceeded

If a booking request would exceed your group's quota:

- **Concurrent Quota**: The request is **rejected**
  - Error message: "GROUP_CONCURRENT_QUOTA_EXCEEDED"
  - Solution: Wait for existing bookings to end or request fewer resources

- **Monthly Quota**: The request is **rejected**
  - Error message: "GROUP_MONTHLY_QUOTA_EXCEEDED"
  - Solution: Wait until next month or request fewer resources

---

## Troubleshooting

### Booking Request Rejected: "CAPACITY_EXCEEDED"

Your resource request exceeds available capacity.

**Solutions:**
- Reduce your resource request (fewer CPUs, GPUs, RAM, or VRAM)
- Choose a different time window when resources are available
- View the temporal booking visualization to find free slots
- Contact your system administrator if capacity needs increase

### Booking Request Rejected: "PREEMPTION_INSUFFICIENT"

You requested foreground resources, but there aren't enough background jobs to preempt.

**Solution:**
- Try requesting fewer resources
- Try a different time window
- Use background workload type if your work is flexible
- Contact your Resource Administrator if you need foreground guarantees

### Booking Request Rejected: "GROUP_QUOTA_EXCEEDED"

Your group has reached its quota limit.

**Solutions:**
- Wait until next calendar month for monthly quotas to reset
- Contact your Group Lead or Resource Administrator
- Request fewer resources or shorter time windows

### Session Expired / Need to Log Back In

**Solution:** Click **Login** and enter your credentials again. Your bookings are preserved.

### Cannot See Team Tab

You must be a **Group Lead** to manage team. Contact your group administrator.

### Timestamps Display Incorrectly

CRAGS uses ISO 8601 UTC timestamps. Verify:
- Your browser timezone settings are correct
- You're interpreting times as UTC (or convert to your local timezone)

### Still Have Issues?

Contact your **System Administrator** or **Resource Administrator** for:
- Password resets
- Access issues
- Quota adjustments
- System capacity questions
- Booking disputes
