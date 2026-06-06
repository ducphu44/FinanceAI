"use client";
import { useState } from "react";
import Header from "@/components/layout/Header";
import { usersList, ROLE_LABELS } from "@/lib/mockData";
import { UserPlus, Edit, UserX, UserCheck, Search, Shield,
         CheckCircle, XCircle } from "lucide-react";

type User = typeof usersList[0];

const ROLE_COLORS: Record<string,string> = {
  admin:           "bg-purple-100 text-purple-700",
  finance_staff:   "bg-blue-100 text-blue-700",
  finance_manager: "bg-green-100 text-green-700",
  leader:          "bg-orange-100 text-orange-700",
};

function Modal({ user, onClose }: { user:User|null; onClose:()=>void }) {
  if (!user) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="font-bold text-slate-800 text-lg mb-4">Edit User</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Full Name</label>
            <input defaultValue={user.name}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Email</label>
            <input defaultValue={user.email}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Role</label>
            <select defaultValue={user.role}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {Object.entries(ROLE_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-colors">
            Save Changes
          </button>
          <button onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-sm transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function AddModal({ onClose }: { onClose:()=>void }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="font-bold text-slate-800 text-lg mb-4">Add New User</h3>
        <div className="space-y-3">
          {[["Full Name","text","e.g. Nguyễn Văn A"],["Email","email","email@example.com"],["Password","password","••••••••"]].map(([l,t,p])=>(
            <div key={l}>
              <label className="text-xs font-medium text-slate-500 block mb-1">{l}</label>
              <input type={t} placeholder={p}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
          ))}
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Role</label>
            <select className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {Object.entries(ROLE_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-colors">
            Create User
          </button>
          <button onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-sm transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [users,     setUsers]     = useState(usersList);
  const [search,    setSearch]    = useState("");
  const [editUser,  setEditUser]  = useState<User|null>(null);
  const [showAdd,   setShowAdd]   = useState(false);

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const toggleActive = (id: number) =>
    setUsers(u => u.map(x => x.id===id ? {...x, isActive:!x.isActive} : x));

  return (
    <div>
      <Header title="User Management" />
      <div className="p-6 space-y-5">

        {/* Top bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
            <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search users…"
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"/>
          </div>
          <button onClick={()=>setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-colors shadow-sm">
            <UserPlus className="w-4 h-4"/>Add User
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {label:"Total Users",    value:users.length,                           color:"text-blue-600",    bg:"bg-blue-50" },
            {label:"Active",         value:users.filter(u=>u.isActive).length,     color:"text-emerald-600", bg:"bg-emerald-50"},
            {label:"Inactive",       value:users.filter(u=>!u.isActive).length,    color:"text-slate-600",   bg:"bg-slate-50"},
            {label:"Admin / Manager",value:users.filter(u=>u.role==="admin"||u.role==="finance_manager").length, color:"text-purple-600",bg:"bg-purple-50"},
          ].map(s=>(
            <div key={s.label} className={`${s.bg} rounded-2xl px-4 py-3 border border-slate-200`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>{["Name","Email","Role","Status","Created","Actions"].map(h=>(
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(u=>(
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {u.name.split(" ").map(w=>w[0]).slice(-2).join("").toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-800">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-500">{u.email}</td>
                    <td className="px-5 py-4">
                      <span className={`flex items-center gap-1 w-fit px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[u.role]}`}>
                        <Shield className="w-3 h-3"/>{ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {u.isActive
                        ? <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium"><CheckCircle className="w-3.5 h-3.5"/>Active</span>
                        : <span className="flex items-center gap-1 text-slate-400 text-xs font-medium"><XCircle className="w-3.5 h-3.5"/>Inactive</span>}
                    </td>
                    <td className="px-5 py-4 text-slate-400 text-xs">{u.createdAt}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <button onClick={()=>setEditUser(u)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit className="w-3.5 h-3.5"/>
                        </button>
                        <button onClick={()=>toggleActive(u.id)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            u.isActive
                              ? "text-slate-500 hover:text-red-600 hover:bg-red-50"
                              : "text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                          }`}>
                          {u.isActive ? <UserX className="w-3.5 h-3.5"/> : <UserCheck className="w-3.5 h-3.5"/>}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
            Showing {filtered.length} of {users.length} users
          </div>
        </div>
      </div>

      {editUser && <Modal user={editUser} onClose={()=>setEditUser(null)}/>}
      {showAdd   && <AddModal onClose={()=>setShowAdd(false)}/>}
    </div>
  );
}
