// Simplified frontend components for demonstration
// In real usage, you can copy the full frontend.tsx from the complex example

import type { FC, PropsWithChildren } from 'hono/jsx';

interface User {
  id: string;
  email: string;
}

interface Organization {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  members: Array<{
    id: string;
    userId: string;
    email: string;
    role: 'admin' | 'member';
    createdAt: string;
  }>;
}

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'archived';
  createdAt: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  projectId: string;
  assignedTo?: string;
  completed: boolean;
  createdAt: string;
}

// Simple layout component
const Layout: FC<PropsWithChildren<{ title: string; user?: User }>> = ({ title, user, children }) => {
  return (
    <html>
      <head>
        <title>{title}</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          body { font-family: Arial, sans-serif; margin: 20px; }
          .container { max-width: 1200px; margin: 0 auto; }
          .header { border-bottom: 1px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
          .nav { display: flex; gap: 20px; margin-top: 15px; }
          .nav a { color: #0066cc; text-decoration: none; padding: 8px 16px; }
          .nav a:hover { background: #f0f8ff; }
          .card { border: 1px solid #ddd; padding: 20px; margin-bottom: 20px; }
          .btn { background: #0066cc; color: white; padding: 10px 20px; border: none; text-decoration: none; }
          .btn:hover { background: #0052a3; }
          .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
          .badge { background: #e9ecef; color: #495057; padding: 2px 8px; border-radius: 12px; font-size: 12px; }
        `}</style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>{title}</h1>
            {user && (
              <div>
                <p>Welcome, {user.email}</p>
                <nav class="nav">
                  <a href="/">Dashboard</a>
                  <a href="/organizations">My Organizations</a>
                  <a href="/organizations/member">Member Of</a>
                  <a href="/logout">Logout</a>
                </nav>
              </div>
            )}
          </div>
          {children}
        </div>
      </body>
    </html>
  );
};

// Login page
export const LoginPage: FC = () => {
  return (
    <Layout title="Login - Clean Team Manager">
      <div style="max-width: 400px; margin: 0 auto;">
        <h2>Login</h2>
        <form action="/login" method="post">
          <div style="margin-bottom: 15px;">
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" required style="width: 100%; padding: 8px;" />
          </div>
          <div style="margin-bottom: 15px;">
            <label for="password">Password:</label>
            <input type="password" id="password" name="password" required style="width: 100%; padding: 8px;" />
          </div>
          <button type="submit" class="btn">Login</button>
        </form>
        <p><a href="/signup">Don't have an account? Sign up</a></p>
      </div>
    </Layout>
  );
};

// Signup page
export const SignupPage: FC = () => {
  return (
    <Layout title="Sign Up - Clean Team Manager">
      <div style="max-width: 400px; margin: 0 auto;">
        <h2>Sign Up</h2>
        <form action="/signup" method="post">
          <div style="margin-bottom: 15px;">
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" required style="width: 100%; padding: 8px;" />
          </div>
          <div style="margin-bottom: 15px;">
            <label for="password">Password:</label>
            <input type="password" id="password" name="password" required minlength="8" style="width: 100%; padding: 8px;" />
          </div>
          <button type="submit" class="btn">Sign Up</button>
        </form>
        <p><a href="/login">Already have an account? Login</a></p>
      </div>
    </Layout>
  );
};

// Dashboard
export const Dashboard: FC<{ user: User; organizations?: Organization[]; memberOrganizations?: any[] }> = ({
  user,
  organizations = [],
  memberOrganizations = []
}) => {
  return (
    <Layout title="Dashboard - Clean Team Manager" user={user}>
      <div class="grid">
        <div class="card">
          <h3>🏢 My Organizations ({organizations.length})</h3>
          {organizations.length === 0 ? (
            <p>You haven't created any organizations yet.</p>
          ) : (
            <ul>
              {organizations.map(org => (
                <li key={org.id}>
                  <a href={`/organizations/${org.id}`}>{org.name}</a>
                  <span class="badge">{org.members?.length || 0} members</span>
                </li>
              ))}
            </ul>
          )}
          <a href="/organizations/new" class="btn">Create Organization</a>
        </div>

        <div class="card">
          <h3>👥 Member Of ({memberOrganizations.length})</h3>
          {memberOrganizations.length === 0 ? (
            <p>You're not a member of any organizations.</p>
          ) : (
            <ul>
              {memberOrganizations.map(org => (
                <li key={org.organizationId}>
                  <a href={`/organizations/${org.organizationId}`}>{org.organizationName}</a>
                  <span class="badge">{org.role}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  );
};

// Organization list
export const OrganizationsPage: FC<{ user: User; organizations: Organization[] }> = ({ user, organizations }) => {
  return (
    <Layout title="My Organizations - Clean Team Manager" user={user}>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2>My Organizations</h2>
        <a href="/organizations/new" class="btn">Create New Organization</a>
      </div>

      <div class="grid">
        {organizations.map(org => (
          <div key={org.id} class="card">
            <h3><a href={`/organizations/${org.id}`}>{org.name}</a></h3>
            <p><strong>Created:</strong> {new Date(org.createdAt).toLocaleDateString()}</p>
            <p><strong>Members:</strong> {org.members?.length || 0}</p>
          </div>
        ))}
      </div>

      {organizations.length === 0 && (
        <div class="card">
          <p>You haven't created any organizations yet. <a href="/organizations/new">Create your first organization</a></p>
        </div>
      )}
    </Layout>
  );
};

// Member organizations page  
export const MemberOrganizationsPage: FC<{ user: User; memberOrganizations: any[] }> = ({ user, memberOrganizations }) => {
  return (
    <Layout title="Member Organizations - Clean Team Manager" user={user}>
      <h2>Organizations I'm a Member Of</h2>
      <div class="grid">
        {memberOrganizations.map(org => (
          <div key={org.organizationId} class="card">
            <h3><a href={`/organizations/${org.organizationId}`}>{org.organizationName}</a></h3>
            <p><strong>Role:</strong> <span class="badge">{org.role}</span></p>
            <p><strong>Joined:</strong> {new Date(org.joinedAt).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
      {memberOrganizations.length === 0 && (
        <div class="card">
          <p>You're not a member of any organizations yet.</p>
        </div>
      )}
    </Layout>
  );
};

// Create organization form
export const CreateOrganizationPage: FC<{ user: User }> = ({ user }) => {
  return (
    <Layout title="Create Organization - Clean Team Manager" user={user}>
      <h2>Create New Organization</h2>
      <form action="/api/organizations" method="post">
        <div style="margin-bottom: 15px;">
          <label for="name">Organization Name:</label>
          <input type="text" id="name" name="name" required style="width: 100%; padding: 8px;" />
        </div>
        <button type="submit" class="btn">Create Organization</button>
        <a href="/organizations" style="margin-left: 10px;">Cancel</a>
      </form>
    </Layout>
  );
};

// Organization detail page
export const OrganizationDetailPage: FC<{
  user: User;
  organization: Organization;
  projects: Project[];
  isOwner: boolean;
  isAdmin: boolean;
  isMember?: boolean;
}> = ({ user, organization, projects, isOwner, isAdmin, isMember = false }) => {
  return (
    <Layout title={`${organization.name} - Clean Team Manager`} user={user}>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2>{organization.name}</h2>
        <div>
          {isMember && <a href={`/organizations/${organization.id}/projects/new`} class="btn">New Project</a>}
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <h3>📋 Projects ({projects.length})</h3>
          {projects.length === 0 ? (
            <p>No projects yet. <a href={`/organizations/${organization.id}/projects/new`}>Create the first project</a></p>
          ) : (
            projects.map(project => (
              <div key={project.id} style="border-bottom: 1px solid #eee; padding: 10px 0;">
                <h4><a href={`/organizations/${organization.id}/projects/${project.id}`}>{project.name}</a></h4>
                <p>{project.description}</p>
                <span class="badge">{project.status}</span>
              </div>
            ))
          )}
        </div>

        <div class="card">
          <h3>👥 Team Members ({organization.members.length})</h3>
          {organization.members.map(member => (
            <div key={member.email} style="padding: 5px 0; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span>{member.email}</span>
                <span class="badge" style="margin-left: 10px;">{member.role}</span>
              </div>
              {isAdmin && (
                <button
                  onclick={`removeMember('${organization.id}', '${member.userId}')`}
                  style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;"
                  title="Remove member"
                >
                  Remove
                </button>
              )}
            </div>
          ))}

          {/* Debug info */}
          <div style="margin-top: 10px; padding: 10px; background: #f0f0f0; font-size: 12px;">
            Debug: isOwner={isOwner ? 'true' : 'false'}, isAdmin={isAdmin ? 'true' : 'false'}, isMember={isMember ? 'true' : 'false'}
          </div>

          {isAdmin && (
            <form action={`/api/organizations/${organization.id}/members`} method="post" style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 15px;">
              <div style="margin-bottom: 10px;">
                <label for="email">Add Member:</label>
                <input type="email" id="email" name="email" placeholder="member@example.com" required style="width: 100%; padding: 8px;" />
              </div>
              <div style="margin-bottom: 10px;">
                <label for="role">Role:</label>
                <select id="role" name="role" style="width: 100%; padding: 8px;">
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button type="submit" class="btn">Add Member</button>
            </form>
          )}
        </div>
      </div>

      <script dangerouslySetInnerHTML={{
        __html: `
          async function removeMember(organizationId, userId) {
            if (!confirm('Are you sure you want to remove this member?')) {
              return;
            }
            
            try {
              const response = await fetch('/api/organizations/' + organizationId + '/members/' + userId, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json'
                }
              });
              
              if (response.ok) {
                window.location.reload();
              } else {
                const error = await response.json();
                alert('Failed to remove member: ' + (error.error || 'Unknown error'));
              }
            } catch (error) {
              alert('Failed to remove member: ' + error.message);
            }
          }
        `
      }} />
    </Layout>
  );
};

// Create project form
export const CreateProjectPage: FC<{ user: User; organizationId: string; organizationName: string }> = ({
  user,
  organizationId,
  organizationName
}) => {
  return (
    <Layout title={`New Project - ${organizationName}`} user={user}>
      <h2>Create New Project in {organizationName}</h2>
      <form action="/api/projects" method="post">
        <input type="hidden" name="organizationId" value={organizationId} />
        <div style="margin-bottom: 15px;">
          <label for="name">Project Name:</label>
          <input type="text" id="name" name="name" required style="width: 100%; padding: 8px;" />
        </div>
        <div style="margin-bottom: 15px;">
          <label for="description">Description:</label>
          <textarea id="description" name="description" rows="3" style="width: 100%; padding: 8px;"></textarea>
        </div>
        <button type="submit" class="btn">Create Project</button>
        <a href={`/organizations/${organizationId}`} style="margin-left: 10px;">Cancel</a>
      </form>
    </Layout>
  );
};

// Project detail page
export const ProjectDetailPage: FC<{
  user: User;
  organization: Organization;
  project: Project;
  tasks: Task[];
}> = ({ user, organization, project, tasks }) => {
  const completedTasks = tasks.filter(t => t.completed);
  const pendingTasks = tasks.filter(t => !t.completed);

  return (
    <Layout title={`${project.name} - ${organization.name}`} user={user}>
      <div style="margin-bottom: 20px;">
        <a href={`/organizations/${organization.id}`}>← Back to {organization.name}</a>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <div>
          <h2>{project.name}</h2>
          <p>{project.description}</p>
          <span class="badge">{project.status}</span>
        </div>
        <a href={`/organizations/${organization.id}/projects/${project.id}/tasks/new`} class="btn">Add Task</a>
      </div>

      <div class="grid">
        <div class="card">
          <h3>⏳ Pending Tasks ({pendingTasks.length})</h3>
          {pendingTasks.length === 0 ? (
            <p>No pending tasks</p>
          ) : (
            pendingTasks.map(task => (
              <div key={task.id} style="border-bottom: 1px solid #eee; padding: 10px 0; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <h4>{task.title}</h4>
                  {task.description && <p>{task.description}</p>}
                  {task.assignedTo && <p><strong>Assigned to:</strong> {task.assignedTo}</p>}
                </div>
                <form action={`/api/tasks/${task.id}/complete`} method="post" style="margin: 0;">
                  <input type="hidden" name="organizationId" value={organization.id} />
                  <input type="hidden" name="projectId" value={project.id} />
                  <button type="submit" class="btn" style="background: #28a745; font-size: 12px; padding: 5px 10px;">
                    ✓ Complete
                  </button>
                </form>
              </div>
            ))
          )}
        </div>

        <div class="card">
          <h3>✅ Completed Tasks ({completedTasks.length})</h3>
          {completedTasks.length === 0 ? (
            <p>No completed tasks</p>
          ) : (
            completedTasks.map(task => (
              <div key={task.id} style="text-decoration: line-through; opacity: 0.6; padding: 5px 0;">
                <h4>{task.title}</h4>
                {task.assignedTo && <p><strong>Completed by:</strong> {task.assignedTo}</p>}
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
};

// Create task form
export const CreateTaskPage: FC<{
  user: User;
  organization: Organization;
  project: Project;
}> = ({ user, organization, project }) => {
  return (
    <Layout title={`New Task - ${project.name}`} user={user}>
      <div style="margin-bottom: 20px;">
        <a href={`/organizations/${organization.id}/projects/${project.id}`}>← Back to {project.name}</a>
      </div>

      <h2>Create New Task in {project.name}</h2>
      <form action="/api/tasks" method="post">
        <input type="hidden" name="projectId" value={project.id} />
        <input type="hidden" name="organizationId" value={organization.id} />
        <div style="margin-bottom: 15px;">
          <label for="title">Task Title:</label>
          <input type="text" id="title" name="title" required style="width: 100%; padding: 8px;" />
        </div>
        <div style="margin-bottom: 15px;">
          <label for="description">Description:</label>
          <textarea id="description" name="description" rows="3" style="width: 100%; padding: 8px;"></textarea>
        </div>
        <div style="margin-bottom: 15px;">
          <label for="assignedTo">Assign to (email):</label>
          <input type="email" id="assignedTo" name="assignedTo" placeholder="member@example.com" style="width: 100%; padding: 8px;" />
        </div>
        <button type="submit" class="btn">Create Task</button>
        <a href={`/organizations/${organization.id}/projects/${project.id}`} style="margin-left: 10px;">Cancel</a>
      </form>
    </Layout>
  );
};

// Organization settings (simplified)
export const OrganizationSettingsPage: FC<{
  user: User;
  organization: Organization;
  isOwner: boolean;
}> = ({ user, organization, isOwner }) => {
  return (
    <Layout title={`${organization.name} Settings`} user={user}>
      <div style="margin-bottom: 20px;">
        <a href={`/organizations/${organization.id}`}>← Back to {organization.name}</a>
      </div>
      <h2>Organization Settings</h2>
      <div class="card">
        <h3>Organization Details</h3>
        <p><strong>Name:</strong> {organization.name}</p>
        <p><strong>Created:</strong> {new Date(organization.createdAt).toLocaleDateString()}</p>
        <p><strong>Members:</strong> {organization.members.length}</p>
      </div>
    </Layout>
  );
};