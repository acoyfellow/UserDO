import { UserDO, createUserDOWorker, createWebSocketHandler, getUserDOFromContext, type Env as BaseEnv } from 'userdo/server';
import { z } from 'zod';
import type { Context } from 'hono';
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

// Define schemas for our business data
const ProjectSchema = z.object({
  name: z.string(),
  description: z.string(),
  status: z.enum(['active', 'completed', 'archived']).default('active'),
});

const TaskSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  projectId: z.string(),
  assignedTo: z.string().optional(),
  completed: z.boolean().default(false),
});

// Organization schemas - these live in the business logic layer
const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  ownerId: z.string(),
  ownerEmail: z.string(),
  createdAt: z.string(),
});

const OrganizationMemberSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  email: z.string(),
  role: z.enum(['admin', 'member']),
  addedAt: z.string(),
});

const OrganizationInviteSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  organizationName: z.string(),
  inviterEmail: z.string(),
  role: z.enum(['admin', 'member']),
  createdAt: z.string(),
});

type Project = z.infer<typeof ProjectSchema>;
type Task = z.infer<typeof TaskSchema>;
type Organization = z.infer<typeof OrganizationSchema>;
type OrganizationMember = z.infer<typeof OrganizationMemberSchema>;
type OrganizationInvite = z.infer<typeof OrganizationInviteSchema>;

// Extended Env interface for TeamDO
interface Env extends BaseEnv {
  TEAM_DO: DurableObjectNamespace<TeamDO>;
}

// 🎉 SUPER CLEAN TeamDO - All organization complexity is now built-in!
export class TeamDO extends UserDO {
  projects: any; // Table<Project>
  tasks: any;    // Table<Task>

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);

    // Organization-scoped tables - data is automatically isolated per organization
    this.projects = this.table('projects', ProjectSchema, { organizationScoped: true });
    this.tasks = this.table('tasks', TaskSchema, { organizationScoped: true });
  }

  // 🚀 Business logic methods - clean and simple!

  async createProject(name: string, description: string, organizationId: string) {
    // Verify access (built-in method handles this)
    await this.getOrganization(organizationId);

    // Set organization context (built-in)
    this.setOrganizationContext(organizationId);

    // Create project - automatically scoped to organization
    return await this.projects.create({
      name,
      description,
      status: 'active',
    });
  }

  async getProjects(organizationId: string) {
    await this.getOrganization(organizationId);
    this.setOrganizationContext(organizationId);
    return await this.projects.orderBy('createdAt', 'desc').get();
  }

  async createTask(title: string, description: string, projectId: string, organizationId: string, assignedTo?: string) {
    await this.getOrganization(organizationId);
    this.setOrganizationContext(organizationId);

    return await this.tasks.create({
      title,
      description,
      projectId,
      assignedTo,
      completed: false,
    });
  }

  async getTasks(organizationId: string, projectId?: string) {
    await this.getOrganization(organizationId);
    this.setOrganizationContext(organizationId);

    if (projectId) {
      return await this.tasks.where('projectId', '==', projectId).get();
    }
    return await this.tasks.orderBy('createdAt', 'desc').get();
  }

  async completeTask(taskId: string, organizationId: string) {
    await this.getOrganization(organizationId);
    this.setOrganizationContext(organizationId);

    return await this.tasks.update(taskId, { completed: true });
  }

  // 🎯 Organization methods are now built into UserDO core!
  // ✅ All organization management is handled by the base UserDO worker endpoints
}

// 🏗️ Create the worker following UserDO patterns
const app = createUserDOWorker('TEAM_DO');
const wsHandler = createWebSocketHandler('TEAM_DO');

// Helper function following the pattern from hono example
const getTeamDO = (c: Context, email: string) => {
  return getUserDOFromContext(c, email, 'TEAM_DO') as TeamDO;
};

const requireAuth = (c: Context) => {
  const user = c.get('user');
  if (!user) {
    return { error: c.json({ error: 'Unauthorized' }, 401), user: null };
  }
  return { user, error: null };
};

// 📝 Add business logic endpoints (the built-in org endpoints are already there!)

// === Project API Endpoints ===

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

    const teamDO = getTeamDO(c, user.email);
    const project = await teamDO.createProject(name, description, organizationId);

    if (contentType.includes('application/json')) {
      return c.json({ project });
    } else {
      return c.redirect(`/organizations/${organizationId}`);
    }
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

// === Task API Endpoints ===

app.post('/api/tasks', async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    let title: string, description: string, projectId: string, organizationId: string, assignedTo: string | undefined;

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

    const teamDO = getTeamDO(c, user.email);
    const task = await teamDO.createTask(title, description, projectId, organizationId, assignedTo);

    if (contentType.includes('application/json')) {
      return c.json({ task });
    } else {
      return c.redirect(`/organizations/${organizationId}/projects/${projectId}`);
    }
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

// === Web Routes ===

app.get('/', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.html(<LoginPage />);
  }

  try {
    const teamDO = getTeamDO(c, user.email);

    // 🎉 Built-in organization methods - no custom logic needed!
    const organizationsResponse = await teamDO.getOrganizations();

    return c.html(
      <Dashboard
        user={user}
        organizations={organizationsResponse.organizations}
        memberOrganizations={organizationsResponse.memberOrganizations}
      />
    );
  } catch (e: any) {
    return c.html(<div>Error: {e.message}</div>);
  }
});

app.get('/login', (c) => c.html(<LoginPage />));
app.get('/signup', (c) => c.html(<SignupPage />));

app.get('/organizations', async (c) => {
  const { user, error } = requireAuth(c);
  if (error) return c.redirect('/login');

  try {
    const teamDO = getTeamDO(c, user!.email);
    const { organizations } = await teamDO.getOrganizations();

    return c.html(<OrganizationsPage user={user!} organizations={organizations} />);
  } catch (e: any) {
    return c.html(<div>Error: {e.message}</div>);
  }
});

app.get('/organizations/member', async (c) => {
  const { user, error } = requireAuth(c);
  if (error) return c.redirect('/login');

  try {
    const teamDO = getTeamDO(c, user!.email);
    const { memberOrganizations } = await teamDO.getOrganizations();

    return c.html(<MemberOrganizationsPage user={user!} memberOrganizations={memberOrganizations} />);
  } catch (e: any) {
    return c.html(<div>Error: {e.message}</div>);
  }
});

app.get('/organizations/new', (c) => {
  const { user, error } = requireAuth(c);
  if (error) return c.redirect('/login');
  return c.html(<CreateOrganizationPage user={user!} />);
});

app.get('/organizations/:id', async (c) => {
  const { user, error } = requireAuth(c);
  if (error) return c.redirect('/login');

  try {
    const organizationId = c.req.param('id');
    const teamDO = getTeamDO(c, user!.email);

    // 🎉 Built-in organization access control
    const { organization, members, isOwner } = await teamDO.getOrganization(organizationId);
    const projects = await teamDO.getProjects(organizationId);

    const userMember = members.find(m => m.email === user!.email);
    const isAdmin = isOwner || userMember?.role === 'admin';
    const isMember = isOwner || !!userMember;

    // Add members to organization object for the component
    const organizationWithMembers = { ...organization, members };

    return c.html(
      <OrganizationDetailPage
        user={user!}
        organization={organizationWithMembers}
        projects={projects}
        isOwner={isOwner}
        isAdmin={isAdmin}
        isMember={isMember}
      />
    );
  } catch (e: any) {
    return c.html(<div>Error: {e.message}</div>);
  }
});

// Project routes
app.get('/organizations/:id/projects/new', async (c) => {
  const { user, error } = requireAuth(c);
  if (error) return c.redirect('/login');

  try {
    const organizationId = c.req.param('id');
    const teamDO = getTeamDO(c, user!.email);

    // Verify access to organization
    const { organization } = await teamDO.getOrganization(organizationId);

    return c.html(
      <CreateProjectPage
        user={user!}
        organizationId={organizationId}
        organizationName={organization.name}
      />
    );
  } catch (e: any) {
    return c.html(<div>Error: {e.message}</div>);
  }
});

app.get('/organizations/:id/projects/:projectId', async (c) => {
  const { user, error } = requireAuth(c);
  if (error) return c.redirect('/login');

  try {
    const organizationId = c.req.param('id');
    const projectId = c.req.param('projectId');
    const teamDO = getTeamDO(c, user!.email);

    // Get organization and project data
    const { organization, members, isOwner } = await teamDO.getOrganization(organizationId);
    const projects = await teamDO.getProjects(organizationId);
    const project = projects.find(p => p.id === projectId);

    if (!project) {
      return c.html(<div>Project not found</div>);
    }

    const tasks = await teamDO.getTasks(organizationId, projectId);

    const userMember = members.find(m => m.email === user!.email);
    const isAdmin = isOwner || userMember?.role === 'admin';
    const isMember = isOwner || !!userMember;

    return c.html(
      <ProjectDetailPage
        user={user!}
        organization={organization}
        project={project}
        tasks={tasks}
        members={members}
        isOwner={isOwner}
        isAdmin={isAdmin}
        isMember={isMember}
      />
    );
  } catch (e: any) {
    return c.html(<div>Error: {e.message}</div>);
  }
});

app.get('/organizations/:id/projects/:projectId/tasks/new', async (c) => {
  const { user, error } = requireAuth(c);
  if (error) return c.redirect('/login');

  try {
    const organizationId = c.req.param('id');
    const projectId = c.req.param('projectId');
    const teamDO = getTeamDO(c, user!.email);

    // Get organization and project data
    const { organization, members } = await teamDO.getOrganization(organizationId);
    const projects = await teamDO.getProjects(organizationId);
    const project = projects.find(p => p.id === projectId);

    if (!project) {
      return c.html(<div>Project not found</div>);
    }

    return c.html(
      <CreateTaskPage
        user={user!}
        organization={organization}
        project={project}
        members={members}
      />
    );
  } catch (e: any) {
    return c.html(<div>Error: {e.message}</div>);
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