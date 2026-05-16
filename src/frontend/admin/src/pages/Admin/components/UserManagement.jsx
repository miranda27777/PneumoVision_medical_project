import React, { useState, useEffect, useCallback } from 'react';
import { adminUserApi } from '../../../api';
import TopNotice from '../../../components/common/TopNotice';
import './UserManagement.css';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const [notice, setNotice] = useState({
    visible: false,
    message: '',
    type: 'info'
  });

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [pageInput, setPageInput] = useState('1');
  const [pageSizeInput, setPageSizeInput] = useState('10');

  // 筛选条件
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'DOCTOR' });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const showNotice = (message, type = 'info') => {
    setNotice({
      visible: true,
      message,
      type
    });
  };

  const closeNotice = useCallback(() => {
    setNotice({
      visible: false,
      message: '',
      type: 'info'
    });
  }, []);

  useEffect(() => {
    setPageInput(String(page + 1));
  }, [page]);

  useEffect(() => {
    setPageSizeInput(String(pageSize));
  }, [pageSize]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        size: pageSize
      };
      
      if (roleFilter && roleFilter !== '') params.role = roleFilter;
      if (statusFilter && statusFilter !== '') params.enabled = statusFilter === 'enabled';

      console.log('请求参数:', params);

      const response = await adminUserApi.listUsers(params);
      console.log('获取用户列表返回:', response);

      if (response.code === 0) {
        setUsers(response.data?.items || response.data || []);
        setTotal(response.data?.total || 0);
      } else {
        showNotice('获取用户列表失败', 'error');
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
      showNotice('获取用户列表失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, pageSize, roleFilter, statusFilter]);

  const handleClearFilters = () => {
    setRoleFilter('');
    setStatusFilter('');
    setPage(0);
  };

  const handleToggleStatus = async (user) => {
    try {
      let response;
      if (user.enabled) {
        response = await adminUserApi.disableUser(user.id);
      } else {
        response = await adminUserApi.enableUser(user.id);
      }
      if (response.code === 0) {
        showNotice(`${user.username} ${user.enabled ? '已禁用' : '已启用'}`, 'success');
        fetchUsers();
      } else {
        showNotice('操作失败：' + response.message, 'error');
      }
    } catch (error) {
      showNotice('操作失败：' + error.message, 'error');
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.password) {
      showNotice('请填写用户名和密码', 'error');
      return;
    }
    try {
      const response = await adminUserApi.createUser(newUser);
      if (response.code === 0) {
        showNotice('用户创建成功', 'success');
        setShowCreateModal(false);
        setNewUser({ username: '', password: '', role: 'DOCTOR' });
        fetchUsers();
      } else {
        showNotice('创建失败：' + response.message, 'error');
      }
    } catch (error) {
      showNotice('创建失败：' + error.message, 'error');
    }
  };

  const goToPage = (pageNumber) => {
    const safePage = Math.min(Math.max(0, pageNumber), totalPages - 1);
    setPage(safePage);
  };

  const commitPageInput = () => {
    if (pageInput.trim() === '') { setPageInput(String(page + 1)); return; }
    const value = Number(pageInput);
    if (!Number.isInteger(value) || value < 1) { setPageInput(String(page + 1)); return; }
    goToPage(value - 1);
  };

  const commitPageSizeInput = () => {
    if (pageSizeInput.trim() === '') { setPageSizeInput(String(pageSize)); return; }
    const value = Number(pageSizeInput);
    if (!Number.isInteger(value) || value < 1) { setPageSizeInput(String(pageSize)); return; }
    setPageSize(value);
    setPage(0);
  };

  return (
    <div className="user-management">
      <TopNotice visible={notice.visible} message={notice.message} type={notice.type} onClose={closeNotice} />

      <div className="page-header">
        <h2>👥 用户管理</h2>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>+ 新建用户</button>
      </div>

      <div className="filters">
        <select className="filter-select" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(0); }}>
          <option value="">全部角色</option>
          <option value="ADMIN">管理员</option>
          <option value="DOCTOR">医生</option>
          <option value="RESEARCHER">科研人员</option>
        </select>

        <select className="filter-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
          <option value="">全部状态</option>
          <option value="enabled">已启用</option>
          <option value="disabled">已禁用</option>
        </select>

        {(roleFilter || statusFilter) && (
          <button className="clear-btn" onClick={handleClearFilters}>🗑️ 清除筛选</button>
        )}
      </div>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="users-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>用户名</th>
                  <th>角色</th>
                  <th>状态</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.length > 0 ? (
                  users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>{user.username}</td>
                      <td>
                        <span className={`role-badge role-${user.role?.toLowerCase()}`}>
                          {user.role === 'ADMIN' ? '管理员' : user.role === 'DOCTOR' ? '医生' : '科研人员'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${user.enabled ? 'status-enabled' : 'status-disabled'}`}>
                          {user.enabled ? '已启用' : '已禁用'}
                        </span>
                      </td>
                      <td>{new Date(user.createdAt).toLocaleString()}</td>
                      <td>
                        <button 
                          className={`action-btn ${user.enabled ? 'disable-btn' : 'enable-btn'}`}
                          onClick={() => handleToggleStatus(user)}
                        >
                          {user.enabled ? '禁用' : '启用'}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="no-data">暂无用户数据</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="pagination-bar">
            <div className="pagination-left">
              <div className="page-size-selector">
                <span>每页显示</span>
                <input 
                  className="page-size-input" 
                  type="text" 
                  value={pageSizeInput}
                  onChange={(e) => setPageSizeInput(e.target.value)}
                  onBlur={commitPageSizeInput}
                  onKeyDown={(e) => e.key === 'Enter' && commitPageSizeInput()} 
                />
                <span>条，共 <strong>{total}</strong> 条记录</span>
              </div>
            </div>
            <div className="pagination-actions">
              <button className="pagination-btn" onClick={() => goToPage(0)} disabled={page === 0}>首页</button>
              <button className="pagination-btn" onClick={() => goToPage(page - 1)} disabled={page === 0}>上一页</button>
              <input 
                className="page-jump-input" 
                type="text" 
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={commitPageInput}
                onKeyDown={(e) => e.key === 'Enter' && commitPageInput()} 
              />
              <span className="page-jump-text">/ {totalPages}</span>
              <button className="pagination-btn" onClick={() => goToPage(page + 1)} disabled={page + 1 >= totalPages}>下一页</button>
              <button className="pagination-btn" onClick={() => goToPage(totalPages - 1)} disabled={page + 1 >= totalPages}>末页</button>
            </div>
          </div>
        </>
      )}

      {/* 创建用户弹窗 */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>新建用户</h3>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>用户名</label>
                <input 
                  type="text" 
                  placeholder="请输入用户名" 
                  value={newUser.username} 
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} 
                />
              </div>
              <div className="form-group">
                <label>密码</label>
                <input 
                  type="password" 
                  placeholder="请输入密码" 
                  value={newUser.password} 
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} 
                />
              </div>
              <div className="form-group">
                <label>角色</label>
                <select 
                  value={newUser.role} 
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="DOCTOR">医生</option>
                  <option value="ADMIN">管理员</option>
                  <option value="RESEARCHER">科研人员</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setShowCreateModal(false)}>取消</button>
              <button className="save-btn" onClick={handleCreateUser}>创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;