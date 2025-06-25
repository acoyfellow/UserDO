import { UserDO, createUserDOWorker, createWebSocketHandler, getUserDOFromContext, getUserDO, type Env as BaseEnv } from 'userdo';
import { z } from 'zod';
import type { Context } from 'hono';
import { getCookie, deleteCookie } from 'hono/cookie';
import {
  LoginPage,
  SignupPage,
  Dashboard,
  OrganizationsPage,
  MemberOrganizationsPage,
  CreateOrganizationPage,
  OrganizationDetailPage,
  OrganizationSettingsPage,
  CreateProjectPage,
  ProjectDetailPage,
  CreateTaskPage
} from './frontend';

// Define schemas for our organization-scoped data
const ProjectSchema = z.object({
  name: z.string(),
  description: z.string(),
  status: z.enum(['active', 'completed', 'archived']).default('active'),
  createdAt: z.string(),
});

const TaskSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  projectId: z.string(),
  assignedTo: z.string().optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  completed: z.boolean().default(false),
  createdAt: z.string(),
});

type Project = z.infer<typeof ProjectSchema>;
type Task = z.infer<typeof TaskSchema>;

// Extended Env interface for TeamDO
interface Env extends BaseEnv {
  TEAM_DO: DurableObjectNamespace<TeamDO>;
}

// User type for proper typing
interface User {
  id: string;
  email: string;
  createdAt: string;
}

// Helper function to get TeamDO with proper hashing
async function getTeamDO(namespace: DurableObjectNamespace<TeamDO>, email: string): Promise<TeamDO> {
  const { hashEmailForId } = await import('userdo');
  const hashedEmail = await hashEmailForId(email.toLowerCase());
  const id = namespace.idFromName(hashedEmail);
  return namespace.get(id);
}

// Extend UserDO with organization-scoped business logic
export class TeamDO extends UserDO {
  projects: any; // Table<Project>
  tasks: any;    // Table<Task>

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);

    // Organization-scoped tables - data is isolated per organization
    this.projects = this.table('projects', ProjectSchema, { organizationScoped: true });
    this.tasks = this.table('tasks', TaskSchema, { organizationScoped: true });
  }

  // Override addMemberToOrganization to include invitation storage
  async addMemberToOrganization(
    { organizationId, email, role = 'member' }:
      { organizationId: string; email: string; role?: 'admin' | 'member' }
  ): Promise<{ ok: boolean }> {
    console.log('TeamDO: Adding member to organization:', { organizationId, email, role });

    // Call the parent method first
    const result = await super.addMemberToOrganization({ organizationId, email, role });

    // Get the organization details for the invitation
    const { organization } = await this.getOrganization({ organizationId });
    const user = await this.raw(); // Use the proper method to get user data

    console.log('TeamDO: About to store invitation for:', email.toLowerCase());

    // Store invitation in the invitee's UserDO
    try {
      console.log('TeamDO: Getting UserDO for email:', email.toLowerCase());

      // Debug: Let's see the hashed email and DO ID
      const hashedEmail = await (await import('userdo')).hashEmailForId(email.toLowerCase());
      console.log('TeamDO: Hashed email for DO ID:', hashedEmail);

      // CRITICAL: getUserDOFromContext uses raw email, but we need hashed email
      // Let's use the same method as getUserDOFromContext but with raw email
      const namespace = (this.env as Env).TEAM_DO;
      const userDOID = namespace.idFromName(email.toLowerCase());
      const inviteeDO = namespace.get(userDOID) as TeamDO;
      console.log('TeamDO: Got UserDO, DO ID type:', typeof inviteeDO.state?.id);
      console.log('TeamDO: Got UserDO, DO ID value:', inviteeDO.state?.id);
      console.log('TeamDO: Got UserDO, DO ID toString():', inviteeDO.state?.id?.toString());
      console.log('TeamDO: Got UserDO, about to call storeInvitation');

      const invitationData = {
        organizationId,
        organizationName: organization.name,
        inviterEmail: user.email,
        role,
        addedAt: new Date().toISOString()
      };

      await inviteeDO.storeInvitation(invitationData);
      console.log('TeamDO: Invitation stored successfully for:', email.toLowerCase());
    } catch (error) {
      console.error('TeamDO: Error storing invitation:', error);
    }

    return result;
  }

  // Store an invitation in this UserDO (called from another UserDO)
  async storeInvitation(invitation: {
    organizationId: string;
    organizationName: string;
    inviterEmail: string;
    role: 'admin' | 'member';
    addedAt: string;
  }): Promise<{ ok: boolean }> {
    // Try to get user, but don't fail if they don't exist yet (haven't signed up)
    let user;
    try {
      user = await this.raw();
      console.log('TeamDO: Storing invitation in UserDO for existing user:', user.email);
    } catch (error) {
      console.log('TeamDO: Storing invitation in UserDO for user who hasnt signed up yet');
      console.log('TeamDO: This is normal - invitations can be stored before signup');
    }

    console.log('TeamDO: Storing invitation:', invitation);

    const key = `invitation:${invitation.organizationId}`;
    console.log('TeamDO: Using storage key:', key);

    await this.storage.put(key, invitation);
    console.log('TeamDO: Invitation stored successfully with key:', key);

    // Verify it was stored by immediately reading it back
    const stored = await this.storage.get(key);
    console.log('TeamDO: Verification - stored data:', stored);

    // List all keys to see what's in storage
    const allKeys = await this.storage.list();
    console.log('TeamDO: All storage keys after storing:', Array.from(allKeys.keys()));

    return { ok: true };
  }

  // Leave organization method
  async leaveOrganization(organizationId: string): Promise<{ ok: boolean }> {
    const user = await this.raw();

    // Get the invitation first before deleting it
    const invitation = await this.storage.get(`invitation:${organizationId}`);

    // Remove the invitation from this user's storage
    await this.storage.delete(`invitation:${organizationId}`);

    // Also remove from the organization's member list
    try {
      if (invitation) {
        const ownerDO = await getUserDO((this.env as Env).TEAM_DO, (invitation as any).inviterEmail);
        await ownerDO.removeMemberFromOrganization({
          organizationId,
          email: user.email
        });
      }
    } catch (error) {
      console.log('Could not remove from organization member list:', error);
      // Continue anyway - the invitation is removed from this user
    }

    return { ok: true };
  }

  // Override getMemberOrganizations to include invitations
  async getMemberOrganizations(): Promise<{ organizations: any[] }> {
    // Try to get user, but don't fail if they don't exist yet
    let user;
    try {
      user = await this.raw();
      console.log('TeamDO: Getting member organizations for existing user:', user.email);
      console.log('TeamDO: Current UserDO ID:', this.state.id.toString());

      // Debug: What should the hashed email be?
      const expectedHash = await (await import('userdo')).hashEmailForId(user.email);
      console.log('TeamDO: Expected hash for', user.email, ':', expectedHash);
    } catch (error) {
      console.log('TeamDO: Getting member organizations for user who hasnt signed up yet');
      console.log('TeamDO: Current UserDO ID:', this.state.id.toString());
      console.log('TeamDO: Will still check for invitations stored before signup');
    }

    const memberOrganizations: any[] = [];

    // First, let's see ALL keys in storage
    const allKeys = await this.storage.list();
    console.log('TeamDO: ALL storage keys:', Array.from(allKeys.keys()));

    // Get invitations stored in this UserDO
    const invitationKeys = await this.storage.list({ prefix: 'invitation:' });
    console.log('TeamDO: Found invitation keys with prefix:', Array.from(invitationKeys.keys()));
    console.log('TeamDO: Invitation keys count:', invitationKeys.size);

    for (const [key, value] of invitationKeys) {
      const invitation = value as any;
      console.log('TeamDO: Processing invitation with key:', key);
      console.log('TeamDO: Processing invitation data:', invitation);
      memberOrganizations.push({
        organizationId: invitation.organizationId,
        organizationName: invitation.organizationName,
        role: invitation.role,
        addedAt: invitation.addedAt,
      });
    }

    console.log('TeamDO: Returning member organizations:', memberOrganizations);
    return { organizations: memberOrganizations };
  }

  // Project management methods
  async createProject(name: string, description: string, organizationId: string) {
    console.log('Creating project:', { name, description, organizationId });

    // Verify user has access to this organization
    const { organization } = await this.getOrganization({ organizationId });
    console.log('Organization verified:', organization.id);

    // Set organization context for data operations
    this.setOrganizationContext(organizationId);
    console.log('Organization context set:', organizationId);

    // Get a fresh table instance with the organization context
    const projectsTable = this.table('projects', ProjectSchema, { organizationScoped: true });

    const result = await projectsTable.create({
      name,
      description,
      status: 'active',
      createdAt: new Date().toISOString(),
    });

    console.log('Project created:', result);
    return result;
  }

  async getProjects(organizationId: string) {
    // Verify access and set context
    await this.getOrganization({ organizationId });
    this.setOrganizationContext(organizationId);

    // Get a fresh table instance with the organization context
    const projectsTable = this.table('projects', ProjectSchema, { organizationScoped: true });
    return await projectsTable.orderBy('createdAt', 'desc').get();
  }

  async createTask(title: string, description: string, projectId: string, organizationId: string, assignedTo?: string) {
    // Verify access and set context
    await this.getOrganization({ organizationId });
    this.setOrganizationContext(organizationId);

    // Get a fresh table instance with the organization context
    const tasksTable = this.table('tasks', TaskSchema, { organizationScoped: true });
    return await tasksTable.create({
      title,
      description,
      projectId,
      assignedTo,
      completed: false,
      createdAt: new Date().toISOString(),
    });
  }

  async getTasks(organizationId: string, projectId?: string) {
    // Verify access and set context
    await this.getOrganization({ organizationId });
    this.setOrganizationContext(organizationId);

    // Get a fresh table instance with the organization context
    const tasksTable = this.table('tasks', TaskSchema, { organizationScoped: true });

    if (projectId) {
      return await tasksTable.where('projectId', '==', projectId).get();
    }

    return await tasksTable.orderBy('createdAt', 'desc').get();
  }

  async completeTask(taskId: string, organizationId: string) {
    console.log('Completing task:', { taskId, organizationId });

    // Verify access and set context
    await this.getOrganization({ organizationId });
    this.setOrganizationContext(organizationId);

    // Get a fresh table instance with the organization context
    const tasksTable = this.table('tasks', TaskSchema, { organizationScoped: true });

    console.log('About to update task with completed: true');
    try {
      const result = await tasksTable.update(taskId, { completed: true });
      console.log('Task update successful:', result);
      return result;
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  }
}

// Create the worker with organization endpoints
const app = createUserDOWorker('TEAM_DO');
const wsHandler = createWebSocketHandler('TEAM_DO');

// Add form handler for organization creation
app.post('/api/organizations', async (c: Context) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    let name: string;

    // Support both JSON and form data
    const contentType = c.req.header('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await c.req.json();
      name = body.name;
    } else {
      const formData = await c.req.formData();
      name = formData.get('name') as string;
    }

    if (!name) {
      return c.json({ error: 'Organization name is required' }, 400);
    }

    const teamDO = await getUserDOFromContext(c, user.email, 'TEAM_DO') as TeamDO;
    const organization = await teamDO.createOrganization({ name });

    // Return appropriate response based on request type
    if (contentType.includes('application/json')) {
      return c.json({ organization });
    } else {
      return c.redirect('/organizations');
    }
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

// Add member to organization - support both JSON and form data
app.post('/api/organizations/members', async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const contentType = c.req.header('content-type') || '';
  let organizationId: string = '';

  try {
    let email: string, role: 'admin' | 'member';

    // Support both JSON and form data
    if (contentType.includes('application/json')) {
      const body = await c.req.json();
      ({ organizationId, email, role } = body);
    } else {
      const formData = await c.req.formData();
      organizationId = formData.get('organizationId') as string;
      email = formData.get('email') as string;
      role = (formData.get('role') as 'admin' | 'member') || 'member';
    }

    if (!organizationId || !email) {
      return c.json({ error: 'Organization ID and email are required' }, 400);
    }

    const teamDO = await getUserDOFromContext(c, user.email, 'TEAM_DO') as TeamDO;
    await teamDO.addMemberToOrganization({ organizationId, email, role });

    // Return appropriate response based on request type
    if (contentType.includes('application/json')) {
      return c.json({ ok: true });
    } else {
      return c.redirect(`/organizations/${organizationId}`);
    }
  } catch (e: any) {
    if (contentType.includes('application/json')) {
      return c.json({ error: e.message }, 400);
    } else {
      const redirectUrl = organizationId
        ? `/organizations/${organizationId}?error=${encodeURIComponent(e.message)}`
        : `/organizations?error=${encodeURIComponent(e.message)}`;
      return c.redirect(redirectUrl);
    }
  }
});

// Remove member from organization - support both JSON and form data
app.delete('/api/organizations/members', async (c: Context) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    const { organizationId, email } = body;

    if (!organizationId || !email) {
      return c.json({ error: 'Organization ID and email are required' }, 400);
    }

    const teamDO = await getUserDOFromContext(c, user.email, 'TEAM_DO') as TeamDO;
    await teamDO.removeMemberFromOrganization({ organizationId, email });

    return c.json({ ok: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

// Leave organization endpoint
app.post('/api/organizations/:id/leave', async (c: Context) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const organizationId = c.req.param('id');
    if (!organizationId) {
      return c.json({ error: 'Organization ID is required' }, 400);
    }

    const teamDO = await getUserDOFromContext(c, user.email, 'TEAM_DO') as TeamDO;
    await teamDO.leaveOrganization(organizationId);

    // Check if this is a form submission or API call
    const contentType = c.req.header('content-type') || '';
    if (contentType.includes('application/json')) {
      return c.json({ ok: true });
    } else {
      return c.redirect('/organizations/member');
    }
  } catch (e: any) {
    const contentType = c.req.header('content-type') || '';
    if (contentType.includes('application/json')) {
      return c.json({ error: e.message }, 400);
    } else {
      return c.redirect(`/organizations/member?error=${encodeURIComponent(e.message)}`);
    }
  }
});

// Debug endpoint to check what's stored in a user's UserDO
app.get('/debug/invitations', async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const teamDO = await getUserDOFromContext(c, user.email, 'TEAM_DO') as TeamDO;

  // Get raw storage data to see what's actually stored
  const allKeys = await teamDO.storage.list();
  const allData: Record<string, any> = {};

  for (const [key, value] of allKeys) {
    allData[key] = value;
  }

  // Use the proper method to get member organizations (which reads invitations)
  const memberOrganizations = await teamDO.getMemberOrganizations();

  return c.json({
    email: user.email,
    allStorageKeys: Array.from(allKeys.keys()),
    allStorageData: allData,
    memberOrganizations: memberOrganizations.organizations,
    debug: 'This shows all storage data and what getMemberOrganizations() returns'
  });
});

// Debug endpoint to manually store an invitation for testing
app.post('/debug/store-invitation', async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { targetEmail, organizationId, organizationName } = await c.req.json();

  if (!targetEmail || !organizationId || !organizationName) {
    return c.json({ error: 'Missing required fields: targetEmail, organizationId, organizationName' }, 400);
  }

  try {
    const namespace = (c.env as any).TEAM_DO;
    const targetDO = await getUserDO(namespace, targetEmail.toLowerCase()) as TeamDO;

    const invitation = {
      organizationId,
      organizationName,
      inviterEmail: user.email,
      role: 'member' as const,
      addedAt: new Date().toISOString()
    };

    await targetDO.storeInvitation(invitation);

    return c.json({
      ok: true,
      message: `Invitation stored for ${targetEmail}`,
      invitation
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Add custom project management endpoints
app.post('/api/projects', async (c: Context) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    let name: string, description: string, organizationId: string;

    // Support both JSON and form data
    const contentType = c.req.header('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await c.req.json();
      ({ name, description, organizationId } = body);
    } else {
      const formData = await c.req.formData();
      name = formData.get('name') as string;
      description = formData.get('description') as string || '';
      organizationId = formData.get('organizationId') as string;
    }

    if (!name || !organizationId) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const teamDO = await getUserDOFromContext(c, user.email, 'TEAM_DO') as TeamDO;
    const project = await teamDO.createProject(name, description, organizationId);

    // Return appropriate response based on request type
    if (contentType.includes('application/json')) {
      return c.json({ project });
    } else {
      return c.redirect(`/organizations/${organizationId}`);
    }
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

app.get('/api/projects/:organizationId', async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const organizationId = c.req.param('organizationId');
    if (!organizationId) return c.json({ error: 'Organization ID required' }, 400);

    const teamDO = await getUserDOFromContext(c, user.email, 'TEAM_DO') as TeamDO;
    const projects = await teamDO.getProjects(organizationId);

    return c.json({ projects });
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

app.post('/api/tasks', async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    let title: string;
    let description: string;
    let projectId: string;
    let organizationId: string;
    let assignedTo: string | undefined;

    // Support both JSON and form data
    const contentType = c.req.header('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await c.req.json();
      ({ title, description, projectId, organizationId, assignedTo } = body);
    } else {
      const formData = await c.req.formData();
      title = formData.get('title') as string;
      description = formData.get('description') as string || '';
      projectId = formData.get('projectId') as string;
      organizationId = formData.get('organizationId') as string;
      assignedTo = formData.get('assignedTo') as string || undefined;
    }

    if (!title || !projectId || !organizationId) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const teamDO = await getUserDOFromContext(c, user.email, 'TEAM_DO') as TeamDO;
    const task = await teamDO.createTask(title, description, projectId, organizationId, assignedTo);

    // Return appropriate response based on request type
    if (contentType.includes('application/json')) {
      return c.json({ task });
    } else {
      return c.redirect(`/organizations/${organizationId}/projects/${projectId}`);
    }
  } catch (e: any) {
    const contentType = c.req.header('content-type') || '';
    if (contentType.includes('application/json')) {
      return c.json({ error: e.message }, 400);
    } else {
      // For form submissions, redirect back with error
      const formData = await c.req.formData().catch(() => null);
      const organizationId = formData?.get('organizationId') as string;
      const projectId = formData?.get('projectId') as string;

      if (organizationId && projectId) {
        return c.redirect(`/organizations/${organizationId}/projects/${projectId}?error=${encodeURIComponent(e.message)}`);
      } else {
        return c.redirect(`/?error=${encodeURIComponent(e.message)}`);
      }
    }
  }
});

app.get('/api/tasks/:organizationId', async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const organizationId = c.req.param('organizationId');
    if (!organizationId) return c.json({ error: 'Organization ID required' }, 400);

    const projectId = c.req.query('projectId');

    const teamDO = await getUserDOFromContext(c, user.email, 'TEAM_DO') as TeamDO;
    const tasks = await teamDO.getTasks(organizationId, projectId);

    return c.json({ tasks });
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

app.put('/api/tasks/:taskId/complete', async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const taskId = c.req.param('taskId');
    const { organizationId } = await c.req.json();

    if (!taskId || !organizationId) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const teamDO = await getUserDOFromContext(c, user.email, 'TEAM_DO') as TeamDO;
    const task = await teamDO.completeTask(taskId, organizationId);

    return c.json({ task });
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

// Web routes for the frontend
app.get('/', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.html(<LoginPage />);
  }

  try {
    const teamDO = await getUserDOFromContext(c, user.email, 'TEAM_DO') as TeamDO;

    let organizations: any[] = [];
    let memberOrganizations: any[] = [];

    try {
      const organizationsResponse = await teamDO.getOrganizations();
      organizations = organizationsResponse?.organizations || [];
    } catch (e) {
      console.error('Error fetching organizations:', e);
    }

    try {
      const memberOrganizationsResponse = await teamDO.getMemberOrganizations();
      memberOrganizations = memberOrganizationsResponse?.organizations || [];
    } catch (e) {
      console.error('Error fetching member organizations:', e);
    }

    return c.html(<Dashboard user={user} organizations={organizations} memberOrganizations={memberOrganizations} />);
  } catch (e: any) {
    return c.html(<div>Error: {e.message} </div>);
  }
});

app.get('/login', (c) => {
  return c.html(<LoginPage />);
});

app.get('/signup', (c) => {
  return c.html(<SignupPage />);
});

app.get('/organizations', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login');

  try {
    const teamDO = await getUserDOFromContext(c, user.email, 'TEAM_DO') as TeamDO;
    const organizationsResponse = await teamDO.getOrganizations();

    return c.html(<OrganizationsPage user={user} organizations={organizationsResponse.organizations} />);
  } catch (e: any) {
    return c.html(<div>Error: {e.message} </div>);
  }
});

app.get('/organizations/member', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login');

  try {
    const teamDO = await getUserDOFromContext(c, user.email, 'TEAM_DO') as TeamDO;

    let memberOrganizations: any[] = [];
    try {
      const memberOrganizationsResponse = await teamDO.getMemberOrganizations();
      memberOrganizations = memberOrganizationsResponse?.organizations || [];
    } catch (e) {
      // If no member organizations found, just use empty array
      console.log('No member organizations found:', e);
      memberOrganizations = [];
    }

    return c.html(<MemberOrganizationsPage user={user} memberOrganizations={memberOrganizations} />);
  } catch (e: any) {
    return c.html(<div>Error: {e.message} </div>);
  }
});

app.get('/organizations/new', (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login');

  return c.html(<CreateOrganizationPage user={user} />);
});

app.get('/logout', async (c) => {
  try {
    const token = getCookie(c, 'token') || '';
    const tokenParts = token.split('.');
    if (tokenParts.length === 3 && tokenParts[1]) {
      const payload = JSON.parse(atob(tokenParts[1]));
      const email = payload.email?.toLowerCase();
      if (email) {
        const teamDO = await getUserDOFromContext(c, email, 'TEAM_DO') as TeamDO;
        await teamDO.logout();
      }
    }
  } catch (e) {
    console.error('Logout error', e);
  }
  deleteCookie(c, 'token');
  deleteCookie(c, 'refreshToken');
  return c.redirect('/');
});

app.get('/organizations/:id', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login');

  try {
    const organizationId = c.req.param('id');
    const teamDO = await getUserDOFromContext(c, user.email, 'TEAM_DO') as TeamDO;

    const { organization } = await teamDO.getOrganization({ organizationId });
    const projects = await teamDO.getProjects(organizationId);

    const isOwner = organization.ownerId === user.id;

    // Check if user is in the organization members list
    const userMember = organization.members.find(m => m.email === user.email);

    // Also check if user has an invitation (for invited members)
    let userRole = userMember?.role;
    if (!userMember && !isOwner) {
      // Check if user has an invitation for this organization
      const memberOrgs = await teamDO.getMemberOrganizations();
      const memberOrg = memberOrgs.organizations.find(org => org.organizationId === organizationId);
      if (memberOrg) {
        userRole = memberOrg.role;
      }
    }

    const isAdmin = isOwner || userRole === 'admin';
    const isMember = isOwner || userMember || userRole;

    return c.html(
      <OrganizationDetailPage
        user={user}
        organization={organization}
        projects={projects}
        isOwner={isOwner}
        isAdmin={isAdmin}
        isMember={!!isMember}
      />
    );
  } catch (e: any) {
    return c.html(<div>Error: {e.message} </div>);
  }
});

app.get('/organizations/:id/settings', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login');

  try {
    const organizationId = c.req.param('id');
    const teamDO = await getUserDOFromContext(c, user.email, 'TEAM_DO') as TeamDO;

    const organizationResponse = await teamDO.getOrganization({ organizationId });
    const organization = organizationResponse.organization;

    const isOwner = organization.ownerId === user.id;
    const userMember = organization.members.find(m => m.email === user.email);
    const isAdmin = isOwner || (userMember && userMember.role === 'admin');

    // Only admins can access settings
    if (!isAdmin) {
      return c.html(<div>Access denied. Only admins can access organization settings.</div>);
    }

    return c.html(
      <OrganizationSettingsPage
        user={user}
        organization={organization}
        isOwner={isOwner}
      />
    );
  } catch (e: any) {
    return c.html(<div>Error: {e.message} </div>);
  }
});

app.get('/organizations/:id/projects/new', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login');

  try {
    const organizationId = c.req.param('id');
    const teamDO = await getUserDOFromContext(c, user.email, 'TEAM_DO') as TeamDO;

    // This will verify the user has access to the organization (owner or member)
    const { organization } = await teamDO.getOrganization({ organizationId });

    return c.html(
      <CreateProjectPage
        user={user}
        organizationId={organizationId}
        organizationName={organization.name}
      />
    );
  } catch (e: any) {
    return c.html(<div>Error: {e.message} </div>);
  }
});

app.get('/organizations/:orgId/projects/:projectId', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login');

  try {
    const organizationId = c.req.param('orgId');
    const projectId = c.req.param('projectId');
    const teamDO = await getUserDOFromContext(c, user.email, 'TEAM_DO') as TeamDO;

    const { organization } = await teamDO.getOrganization({ organizationId });
    const projects = await teamDO.getProjects(organizationId);
    const project = projects.find(p => p.id === projectId);

    if (!project) {
      return c.html(<div>Project not found </div>);
    }

    const tasks = await teamDO.getTasks(organizationId, projectId);

    return c.html(
      <ProjectDetailPage
        user={user}
        organization={organization}
        project={project}
        tasks={tasks}
      />
    );
  } catch (e: any) {
    return c.html(<div>Error: {e.message} </div>);
  }
});

app.get('/organizations/:orgId/projects/:projectId/tasks/new', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login');

  try {
    const organizationId = c.req.param('orgId');
    const projectId = c.req.param('projectId');
    const teamDO = await getUserDOFromContext(c, user.email, 'TEAM_DO') as TeamDO;

    const { organization } = await teamDO.getOrganization({ organizationId });
    const projects = await teamDO.getProjects(organizationId);
    const project = projects.find(p => p.id === projectId);

    if (!project) {
      return c.html(<div>Project not found </div>);
    }

    return c.html(
      <CreateTaskPage
        user={user}
        organization={organization}
        project={project}
      />
    );
  } catch (e: any) {
    return c.html(<div>Error: {e.message} </div>);
  }
});

// Export the worker with WebSocket support
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.headers.get('upgrade') === 'websocket') {
      return wsHandler.fetch(request, env, ctx);
    }
    return app.fetch(request, env, ctx);
  }
};