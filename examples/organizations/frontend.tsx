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
    email: string;
    role: 'admin' | 'member';
    addedAt: string;
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

// Layout component
const Layout: FC<PropsWithChildren<{ title: string; user?: User }>> = ({ title, user, children }) => {
  return (
    <html>
      <head>
        <title>{title}</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          html {
          font-family: Avenir, Inter, Roboto, sans-serif;
          }
          body { margin: 0; padding: 20px; background: #f5f5f5; }
          .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { border-bottom: 1px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
          .nav { display: flex; gap: 20px; margin-top: 15px; }
          .nav a { color: #0066cc; text-decoration: none; padding: 8px 16px; border-radius: 4px; }
          .nav a:hover { background: #f0f8ff; }
          .card { border: 1px solid #ddd; border-radius: 6px; padding: 20px; margin-bottom: 20px; background: #fafafa; }
          .form-group { margin-bottom: 15px; }
          .form-group label { display: block; margin-bottom: 5px; font-weight: 500; }
          .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
          .btn { background: #0066cc; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; }
          .btn:hover { background: #0052a3; }
          .btn-secondary { background: #6c757d; }
          .btn-danger { background: #dc3545; }
          .btn-small { padding: 5px 10px; font-size: 12px; }
          .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
          .badge { background: #e9ecef; color: #495057; padding: 2px 8px; border-radius: 12px; font-size: 12px; }
          .badge-admin { background: #d4edda; color: #155724; }
          .badge-member { background: #d1ecf1; color: #0c5460; }
          .badge-active { background: #d4edda; color: #155724; }
          .badge-completed { background: #f8d7da; color: #721c24; }
          .task-completed { text-decoration: line-through; opacity: 0.6; }
          .error { color: #dc3545; background: #f8d7da; padding: 10px; border-radius: 4px; margin-bottom: 15px; }
          .success { color: #155724; background: #d4edda; padding: 10px; border-radius: 4px; margin-bottom: 15px; }
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
        <script dangerouslySetInnerHTML={{
          __html: `
          // Simple form helpers
          function submitForm(formId, endpoint, method = 'POST') {
            const form = document.getElementById(formId);
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            fetch(endpoint, {
              method: method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(data => {
              if (data.error) {
                alert('Error: ' + data.error);
              } else {
                window.location.reload();
              }
            })
            .catch(error => {
              alert('Error: ' + error.message);
            });
          }
          
          function deleteItem(endpoint, confirmMessage, data = null) {
            if (confirm(confirmMessage)) {
              const options = { method: 'DELETE' };
              if (data) {
                options.headers = { 'Content-Type': 'application/json' };
                options.body = JSON.stringify(data);
              }
              fetch(endpoint, options)
              .then(() => window.location.reload())
              .catch(error => alert('Error: ' + error.message));
            }
          }
          
          function removeMember(organizationId, email) {
            deleteItem('/api/organizations/members', \`Remove \${email} from organization?\`, {
              organizationId: organizationId,
              email: email
            });
          }
          `
        }}></script>
      </body>
    </html>
  );
};

// Login page
export const LoginPage: FC = () => {
  return (
    <Layout title="Login - Team Manager">
      <div style="max-width: 400px; margin: 0 auto;">
        <h2>Login</h2>
        <form action="/login" method="post">
          <div class="form-group">
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" required />
          </div>
          <div class="form-group">
            <label for="password">Password:</label>
            <input type="password" id="password" name="password" required />
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
    <Layout title="Sign Up - Team Manager">
      <div style="max-width: 400px; margin: 0 auto;">
        <h2>Sign Up</h2>
        <form action="/signup" method="post">
          <div class="form-group">
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" required />
          </div>
          <div class="form-group">
            <label for="password">Password:</label>
            <input type="password" id="password" name="password" required minlength="8" />
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
    <Layout title="Dashboard - Team Manager" user={user}>
      <div class="grid">
        <div class="card">
          <h3>My Organizations ({organizations.length})</h3>
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
          <h3>Member Of ({memberOrganizations.length})</h3>
          {memberOrganizations.length === 0 ? (
            <p>You're not a member of any organizations.</p>
          ) : (
            <ul>
              {memberOrganizations.map(org => (
                <li key={org.organizationId}>
                  <a href={`/organizations/${org.organizationId}`}>{org.organizationName}</a>
                  <span class={`badge badge-${org.role}`}>{org.role}</span>
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
    <Layout title="My Organizations - Team Manager" user={user}>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2>My Organizations</h2>
        <a href="/organizations/new" class="btn">Create New Organization</a>
      </div>

      <div class="grid">
        {organizations.map(org => (
          <div key={org.id} class="card">
            <h3><a href={`/organizations/${org.id}`}>{org.name}</a></h3>
            <p><strong>Created:</strong> {new Date(org.createdAt).toLocaleDateString()}</p>
            <p><strong>Members:</strong> {org.members.length}</p>
            <div>
              {org.members.map(member => (
                <span key={member.email} class={`badge badge-${member.role}`} style="margin-right: 5px;">
                  {member.email} ({member.role})
                </span>
              ))}
            </div>
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
    <Layout title="Member Organizations - Team Manager" user={user}>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2>Organizations I'm a Member Of</h2>
      </div>

      <div class="grid">
        {memberOrganizations.map(org => (
          <div key={org.organizationId} class="card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <h3><a href={`/organizations/${org.organizationId}`}>{org.organizationName}</a></h3>
                <p><strong>Role:</strong> <span class={`badge badge-${org.role}`}>{org.role}</span></p>
                <p><strong>Joined:</strong> {new Date(org.addedAt).toLocaleDateString()}</p>
              </div>
              <form action={`/api/organizations/${org.organizationId}/leave`} method="post" style="margin: 0;">
                <button
                  type="submit"
                  class="btn btn-danger btn-small"
                  onclick="return confirm('Are you sure you want to leave this organization?')"
                >
                  Leave
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>

      {memberOrganizations.length === 0 && (
        <div class="card">
          <p>You're not a member of any organizations yet. Ask an organization owner to invite you!</p>
        </div>
      )}
    </Layout>
  );
};

// Create organization form
export const CreateOrganizationPage: FC<{ user: User }> = ({ user }) => {
  return (
    <Layout title="Create Organization - Team Manager" user={user}>
      <h2>Create New Organization</h2>
      <form action="/api/organizations" method="post">
        <div class="form-group">
          <label for="name">Organization Name:</label>
          <input type="text" id="name" name="name" required />
        </div>
        <button type="submit" class="btn">Create Organization</button>
        <a href="/organizations" class="btn btn-secondary" style="margin-left: 10px;">Cancel</a>
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
    <Layout title={`${organization.name} - Team Manager`} user={user}>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2>{organization.name}</h2>
        <div>
          {isMember && <a href={`/organizations/${organization.id}/projects/new`} class="btn">New Project</a>}
          {isAdmin && <a href={`/organizations/${organization.id}/settings`} class="btn btn-secondary" style="margin-left: 10px;">Settings</a>}
          {!isOwner && isMember && (
            <form action={`/api/organizations/${organization.id}/leave`} method="post" style="display: inline; margin-left: 10px;">
              <button
                type="submit"
                class="btn btn-danger"
                onclick="return confirm('Are you sure you want to leave this organization?')"
              >
                Leave Organization
              </button>
            </form>
          )}
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <h3>Projects ({projects.length})</h3>
          {projects.length === 0 ? (
            <p>No projects yet. <a href={`/organizations/${organization.id}/projects/new`}>Create the first project</a></p>
          ) : (
            <div>
              {projects.map(project => (
                <div key={project.id} style="border-bottom: 1px solid #eee; padding: 10px 0;">
                  <h4><a href={`/organizations/${organization.id}/projects/${project.id}`}>{project.name}</a></h4>
                  <p>{project.description}</p>
                  <span class={`badge badge-${project.status}`}>{project.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div class="card">
          <h3>Team Members ({organization.members.length})</h3>
          {organization.members.map(member => (
            <div key={member.email} style="display: flex; justify-content: space-between; align-items: center; padding: 5px 0;">
              <span>{member.email}</span>
              <div>
                <span class={`badge badge-${member.role}`}>{member.role}</span>
                {isOwner && member.email !== user.email && (
                  <button
                    class="btn btn-danger btn-small"
                    style="margin-left: 10px;"
                    onclick={`removeMember('${organization.id}', '${member.email}')`}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}

          {isAdmin && (
            <form action="/api/organizations/members" method="post" style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 15px;">
              <input type="hidden" name="organizationId" value={organization.id} />
              <div class="form-group">
                <label for="email">Add Member:</label>
                <input type="email" id="email" name="email" placeholder="member@example.com" required />
              </div>
              <div class="form-group">
                <label for="role">Role:</label>
                <select id="role" name="role">
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button type="submit" class="btn btn-small">Add Member</button>
            </form>
          )}
        </div>
      </div>
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
        <div class="form-group">
          <label for="name">Project Name:</label>
          <input type="text" id="name" name="name" required />
        </div>
        <div class="form-group">
          <label for="description">Description:</label>
          <textarea id="description" name="description" rows="3"></textarea>
        </div>
        <button type="submit" class="btn">Create Project</button>
        <a href={`/organizations/${organizationId}`} class="btn btn-secondary" style="margin-left: 10px;">Cancel</a>
      </form>
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
        <div class="form-group">
          <label for="title">Task Title:</label>
          <input type="text" id="title" name="title" required />
        </div>
        <div class="form-group">
          <label for="description">Description:</label>
          <textarea id="description" name="description" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label for="assignedTo">Assign to (email):</label>
          <input type="email" id="assignedTo" name="assignedTo" placeholder="member@example.com" />
        </div>
        <button type="submit" class="btn">Create Task</button>
        <a href={`/organizations/${organization.id}/projects/${project.id}`} class="btn btn-secondary" style="margin-left: 10px;">Cancel</a>
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
          <span class={`badge badge-${project.status}`}>{project.status}</span>
        </div>
        <a href={`/organizations/${organization.id}/projects/${project.id}/tasks/new`} class="btn">Add Task</a>
      </div>

      <div class="grid">
        <div class="card">
          <h3>Pending Tasks ({pendingTasks.length})</h3>
          {pendingTasks.length === 0 ? (
            <p>No pending tasks</p>
          ) : (
            pendingTasks.map(task => (
              <div key={task.id} style="border-bottom: 1px solid #eee; padding: 10px 0;">
                <h4>{task.title}</h4>
                {task.description && <p>{task.description}</p>}
                {task.assignedTo && <p><strong>Assigned to:</strong> {task.assignedTo}</p>}
                <button
                  class="btn btn-small"
                  onclick={`submitForm('completeTask${task.id}', '/api/tasks/${task.id}/complete', 'PUT')`}
                >
                  Mark Complete
                </button>
                <form id={`completeTask${task.id}`} style="display: none;">
                  <input type="hidden" name="organizationId" value={organization.id} />
                </form>
              </div>
            ))
          )}
        </div>

        <div class="card">
          <h3>Completed Tasks ({completedTasks.length})</h3>
          {completedTasks.length === 0 ? (
            <p>No completed tasks</p>
          ) : (
            completedTasks.map(task => (
              <div key={task.id} class="task-completed" style="padding: 5px 0;">
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

// Organization settings page
export const OrganizationSettingsPage: FC<{
  user: User;
  organization: Organization;
  isOwner: boolean;
}> = ({ user, organization, isOwner }) => {
  return (
    <Layout title={`${organization.name} Settings - Team Manager`} user={user}>
      <div style="margin-bottom: 20px;">
        <a href={`/organizations/${organization.id}`}>← Back to {organization.name}</a>
      </div>

      <h2>Organization Settings</h2>

      <div class="grid">
        <div class="card">
          <h3>Organization Details</h3>
          <form action={`/api/organizations/${organization.id}`} method="post">
            <input type="hidden" name="_method" value="PUT" />
            <div class="form-group">
              <label for="name">Organization Name:</label>
              <input type="text" id="name" name="name" value={organization.name} required />
            </div>
            {isOwner && (
              <button type="submit" class="btn">Update Organization</button>
            )}
          </form>
        </div>

        <div class="card">
          <h3>Danger Zone</h3>
          {isOwner ? (
            <div>
              <p>Once you delete an organization, there is no going back. Please be certain.</p>
              <button
                class="btn btn-danger"
                onclick={`deleteItem('/api/organizations/${organization.id}', 'Are you sure you want to delete this organization? This action cannot be undone.')`}
              >
                Delete Organization
              </button>
            </div>
          ) : (
            <div>
              <p>Leave this organization. You can be re-invited later.</p>
              <button
                class="btn btn-danger"
                onclick={`deleteItem('/api/organizations/members', 'Are you sure you want to leave this organization?')`}
              >
                Leave Organization
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};