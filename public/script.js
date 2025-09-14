let current_user = null;

// Custom notification
function show_notification(message) { 
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px;
    border-radius: 5px;
    background-color: var(--primary-color);
    color: white;
    z-index: 1000;
    max-width: 300px;
  `;
  
  document.body.appendChild(notification);
  setTimeout(() => {
    document.body.removeChild(notification);
  }, 3000);
}

// API call helper
async function api_call(url, method = 'GET', data = null) {
  const options = { method: method, headers: { 'Content-Type': 'application/json' } };
  if (data) { options.body = JSON.stringify(data); }
  const res = await fetch(url, options);
  if (!res.ok) {
    let error_message = 'Request failed';
    try { 
      const error_data = await res.json(); 
      error_message = error_data.message || error_message; 
    } catch { 
      error_message = `Request failed with status ${res.status}: ${res.statusText}`; 
    }
    throw new Error(error_message);
  }
  return res.json();
}

// Page navigation
function show_page(page_id) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const el = document.getElementById(page_id);
  if (el) el.classList.add("active");
  if (page_id === 'admin_dashboard_page') { 
    document.body.classList.add('admin-mode'); 
  } else { 
    document.body.classList.remove('admin-mode'); 
  }
  window.location.hash = page_id;
  window.scrollTo(0, 0);
  if (page_id === 'admin_dashboard_page' && current_user?.role === 'admin') { 
    load_admin_contacts(); 
  }
}

// Update navigation
function update_nav_links() {
  const login_nav_link = document.getElementById('login_nav_link');
  const logout_nav_link = document.getElementById('logout_nav_link');
  const admin_nav_link = document.getElementById('admin_nav_link');
  const service_nav_link = document.getElementById('service_nav_link');
  const contact_nav_link = document.getElementById('contact_nav_link');
  
  if (current_user) {
    login_nav_link.classList.add('hidden');
    logout_nav_link.classList.remove('hidden');
    service_nav_link.classList.remove('hidden');
    contact_nav_link.classList.add('hidden');
    
    if (current_user.role === 'admin') { 
      admin_nav_link.classList.remove('hidden'); 
    } else { 
      admin_nav_link.classList.add('hidden'); 
    }
  } else {
    login_nav_link.classList.remove('hidden');
    logout_nav_link.classList.add('hidden');
    admin_nav_link.classList.add('hidden');
    service_nav_link.classList.add('hidden');
    contact_nav_link.classList.remove('hidden');
  }
}

// User logout
function logout() { 
  current_user = null; 
  update_nav_links(); 
  show_page('home_page'); 
  show_notification('You have been logged out.'); 
}

// Handle services button click
function handle_explore_services() {
  if (current_user) { 
    show_page('service_page'); 
  } else { 
    show_notification('Please login to access our services.'); 
    show_page('login_page'); 
  }
}

// Calculator
function calculate_price() {
  const service_type = document.getElementById('service_type').value;
  const project_scale = document.getElementById('project_scale').value;
  let base_price = 0; 
  let scale_factor = 1;
  
  switch (service_type) {
    case 'branding': base_price = 1000; break;
    case 'development': base_price = 4500; break;
    case 'marketing': base_price = 2000; break;
    case 'analytics': base_price = 2500; break;
    case 'consulting': base_price = 1500; break;
  }
  
  switch (project_scale) {
    case 'small': scale_factor = 1; break;
    case 'medium': scale_factor = 2.5; break;
    case 'large': scale_factor = 5; break;
    case 'enterprise': scale_factor = 10; break;
  }
  
  const final_price = base_price * scale_factor;
  document.getElementById('price_result').textContent = `$${final_price.toFixed(2)}`;
}

// Load messages for admin
async function load_admin_contacts() {
  const messages_list_div = document.getElementById('contact_messages_list');
  if (!messages_list_div) return;
  messages_list_div.innerHTML = '<p>Loading contact messages...</p>';
  
  try {
    const contacts = await api_call('/api/admin/contacts');
    if (!contacts || contacts.length === 0) { 
      messages_list_div.innerHTML = '<p>No contact messages found.</p>'; 
      return; 
    }
    
    let html = '<table><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Service</th><th>Message</th><th>Received At</th><th>Actions</th></tr></thead><tbody>';
    contacts.forEach(contact => {
      const date = new Date(contact.created_at).toLocaleString();
      html += `
        <tr id="contact-row-${contact.id}">
          <td>${contact.id}</td>
          <td>${contact.full_name}</td>
          <td>${contact.email}</td>
          <td>${contact.service_interest || 'N/A'}</td>
          <td>${contact.message}</td>
          <td>${date}</td>
          <td>
            <button class="btn info" onclick="edit_contact_name(${contact.id})">Update</button>
            <button class="btn danger" onclick="delete_contact(${contact.id})">Delete</button>
          </td>
        </tr>
      `;
    });
    html += '</tbody></table>';
    messages_list_div.innerHTML = html;
  } catch (err) {
    messages_list_div.innerHTML = `<p style="color: var(--danger-color);">Error loading messages: ${err.message}</p>`;
    console.error('Failed to load admin contacts:', err);
  }
}

// Delete contact
async function delete_contact(id) {
  if (!confirm(`Are you sure you want to delete contact message ID: ${id}?`)) return;
  try {
    const res = await api_call(`/api/contacts/${id}`, 'DELETE');
    show_notification(res.message);
    document.getElementById(`contact-row-${id}`)?.remove();
  } catch (err) { 
    show_notification(`Failed to delete contact: ${err.message}`); 
    console.error('Error deleting contact:', err); 
  }
}

// Update contact
async function edit_contact_name(id) {
  try {
    const contact = await api_call(`/api/admin/contacts/${id}`);
    const new_name = prompt(`Edit Full Name for contact ID ${id}:`, contact.full_name);
    if (new_name === null) return;
    if (!new_name.trim()) { 
      show_notification('Full Name cannot be empty.'); 
      return; 
    }
    
    const res = await api_call(`/api/contacts/${id}`, 'PUT', { full_name: new_name.trim() });
    show_notification(res.message);
    const row = document.getElementById(`contact-row-${id}`);
    if (row) { 
      row.children[1].textContent = res.contact.full_name; 
    }
  } catch (err) { 
    show_notification(`Failed to edit contact name: ${err.message}`); 
    console.error('Error editing contact name:', err); 
  }
}

document.addEventListener("DOMContentLoaded", () => {
  update_nav_links();
  
  const explore_button = document.getElementById('explore_services_btn');
  if (explore_button) { 
    explore_button.addEventListener('click', handle_explore_services); 
  }
  
  const initial_page = window.location.hash ? window.location.hash.substring(1) : 'home_page';
  if (initial_page === 'admin_dashboard_page' && current_user?.role !== 'admin') {
    show_notification('Access denied. Admin privileges required.');
    show_page('home_page');
  } else if (initial_page === 'service_page' && !current_user) {
    show_notification('Please login to access the Service page.');
    show_page('home_page');
  } else {
    show_page(initial_page);
  }

  // Handler Login
  document.getElementById('register_form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const feedback_div = document.getElementById('register_form_feedback');
    feedback_div.textContent = '';
    
    if (f.register_password.value !== f.confirm_password.value) {
      feedback_div.textContent = 'Passwords do not match.';
      feedback_div.style.color = 'var(--danger-color)';
      return;
    }
    
    try {
      const res = await api_call('/api/register', 'POST', {
        full_name: f.register_full_name.value,
        email: f.register_email.value,
        password: f.register_password.value
      });
      feedback_div.textContent = res.message;
      feedback_div.style.color = 'var(--primary-color)';
      f.reset();
      setTimeout(() => show_page('login_page'), 1500);
    } catch (err) {
      feedback_div.textContent = err.message;
      feedback_div.style.color = 'var(--danger-color)';
    }
  });

  // Handler Login
  document.getElementById('login_form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const feedback_div = document.getElementById('login_form_feedback');
    feedback_div.textContent = '';
    
    try {
      const res = await api_call('/api/login', 'POST', {
        email: f.login_email.value,
        password: f.login_password.value
      });
      current_user = res.user;
      update_nav_links();
      show_notification('You have been logged in.');
      feedback_div.textContent = res.message;
      feedback_div.style.color = 'var(--primary-color)';
      f.reset();
      setTimeout(() => show_page(current_user.role === 'admin' ? 'admin_dashboard_page' : 'home_page'), 1000);
    } catch (err) {
      feedback_div.textContent = err.message;
      feedback_div.style.color = 'var(--danger-color)';
    }
  });

  // Handler Contact
  document.getElementById('contact_form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const feedback_div = document.getElementById('contact_form_feedback');
    feedback_div.textContent = '';
    
    try {
      const res = await api_call('/api/contact', 'POST', {
        full_name: f.full_name.value,
        email: f.email.value,
        service_interest: f.service_interest.value,
        message: f.message.value
      });
      show_notification(res.message);
      feedback_div.textContent = '';
      f.reset();
    } catch (err) {
      feedback_div.textContent = err.message;
      feedback_div.style.color = 'var(--danger-color)';
    }
  });
});