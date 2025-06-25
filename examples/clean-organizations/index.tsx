import { UserDO, createUserDOWorker, createWebSocketHandler, getUserDOFromContext, type Env as BaseEnv } from 'userdo';
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
  assignedTo: z.string().optional(),
  completed: z.boolean().default(false),
  createdAt: z.string(),
});

type Project = z.infer<typeof ProjectSchema>;
type Task = z.infer<typeof TaskSchema>;

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
    await this.getOrganization({ organizationId });
    
    // Set organization context (built-in)
    this.setOrganizationContext(organizationId);
    
    // Create project - automatically scoped to organization
    return await this.projects.create({
      name,
      description,
      status: 'active',
      createdAt: new Date().toISOString(),
    });
  }

  async getProjects(organizationId: string) {
    await this.getOrganization({ organizationId });
    this.setOrganizationContext(organizationId);
    return await this.projects.orderBy('createdAt', 'desc').get();
  }

  async createTask(title: string, description: string, projectId: string, organizationId: string, assignedTo?: string) {
    await this.getOrganization({ organizationId });
    this.setOrganizationContext(organizationId);
    
    return await this.tasks.create({
      title,
      description,
      projectId,
      assignedTo,
      completed: false,
      createdAt: new Date().toISOString(),
    });
  }

  async getTasks(organizationId: string, projectId?: string) {
    await this.getOrganization({ organizationId });
    this.setOrganizationContext(organizationId);

    if (projectId) {
      return await this.tasks.where('projectId', '==', projectId).get();
    }
    return await this.tasks.orderBy('createdAt', 'desc').get();
  }

  async completeTask(taskId: string, organizationId: string) {
    await this.getOrganization({ organizationId });
    this.setOrganizationContext(organizationId);
    return await this.tasks.update(taskId, { completed: true });
  }

  // 🎯 No need to override organization methods - they work automatically!
  // ✅ createOrganization() - built-in
  // ✅ addMemberToOrganization() - built-in with automatic invitations
  // ✅ getMemberOrganizations() - built-in, returns stored invitations
  // ✅ getOrganization() - built-in with access control
  // ✅ removeMemberFromOrganization() - built-in
}

// 🏗️ Create the worker with built-in organization endpoints
const app = createUserDOWorker('TEAM_DO');
const wsHandler = createWebSocketHandler('TEAM_DO');

// 📝 Add business logic endpoints (the built-in org endpoints are already there!)

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

    if (contentType.includes('application/json')) {
      return c.json({ project });
    } else {
      return c.redirect(`/organizations/${organizationId}`);
    }
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

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

    const teamDO = await getUserDOFromContext(c, user.email, 'TEAM_DO') as TeamDO;
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

// 🎨 Web routes for the frontend

app.get('/', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.html(<LoginPage />);
  }

  try {
    const teamDO = await getUserDOFromContext(c, user.email, 'TEAM_DO') as TeamDO;

    // 🎉 Built-in organization methods - no custom logic needed!
    const organizationsResponse = await teamDO.getOrganizations();
    const memberOrganizationsResponse = await teamDO.getMemberOrganizations();

    return c.html(
      <Dashboard 
        user={user} 
        organizations={organizationsResponse.organizations} 
        memberOrganizations={memberOrganizationsResponse.organizations} 
      />
    );
  } catch (e: any) {
    return c.html(<div>Error: {e.message}</div>);
  }
});

app.get('/login', (c) => c.html(<LoginPage />));
app.get('/signup', (c) => c.html(<SignupPage />));

app.get('/organizations', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login');

  try {
    const teamDO = await getUserDOFromContext(c, user.email, 'TEAM_DO') as TeamDO;
    const { organizations } = await teamDO.getOrganizations();

    return c.html(<OrganizationsPage user={user} organizations={organizations} />);
  } catch (e: any) {
    return c.html(<div>Error: {e.message}</div>);
  }
});

app.get('/organizations/member', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login');

  try {
    const teamDO = await getUserDOFromContext(c, user.email, 'TEAM_DO') as TeamDO;
    const { organizations: memberOrganizations } = await teamDO.getMemberOrganizations();

    return c.html(<MemberOrganizationsPage user={user} memberOrganizations={memberOrganizations} />);
  } catch (e: any) {
    return c.html(<div>Error: {e.message}</div>);
  }
});

app.get('/organizations/new', (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login');
  return c.html(<CreateOrganizationPage user={user} />);
});

app.get('/organizations/:id', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login');

  try {
    const organizationId = c.req.param('id');
    const teamDO = await getUserDOFromContext(c, user.email, 'TEAM_DO') as TeamDO;

    // 🎉 Built-in organization access control
    const { organization } = await teamDO.getOrganization({ organizationId });
    const projects = await teamDO.getProjects(organizationId);

    const isOwner = organization.ownerId === user.id;
    const userMember = organization.members.find(m => m.email === user.email);
    
    // Check member organizations for invited users
    let userRole = userMember?.role;
    if (!userMember && !isOwner) {
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
    return c.html(<div>Error: {e.message}</div>);
  }
});

app.get('/organizations/:id/projects/new', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login');

  try {
    const organizationId = c.req.param('id');
    const teamDO = await getUserDOFromContext(c, user.email, 'TEAM_DO') as TeamDO;
    const { organization } = await teamDO.getOrganization({ organizationId });

    return c.html(
      <CreateProjectPage
        user={user}
        organizationId={organizationId}
        organizationName={organization.name}
      />
    );
  } catch (e: any) {
    return c.html(<div>Error: {e.message}</div>);
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
      return c.html(<div>Project not found</div>);
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
    return c.html(<div>Error: {e.message}</div>);
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
      return c.html(<div>Project not found</div>);
    }

    return c.html(
      <CreateTaskPage
        user={user}
        organization={organization}
        project={project}
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