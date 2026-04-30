import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, TrendingUp, ShieldOff, Bot, Trophy, Zap } from 'lucide-react';
import { useStore } from '../store/useStore';
import { authFetch } from '../lib/supabase';
import { apiUrl } from '../lib/api';

const TYPE_ICONS = {
    TRADE_EXECUTED:    <TrendingUp size={14} color="var(--accent-green)" />,
    CIRCUIT_BREAKER:   <ShieldOff size={14} color="var(--accent-red)" />,
    AI_SIGNAL:         <Bot size={14} color="var(--accent-blue)" />,
    KILL_SWITCH:       <ShieldOff size={14} color="var(--accent-red)" />,
    STRATEGY_PROMOTED: <Trophy size={14} color="#af52de" />,
};

export default function NotificationCenter() {
    const { notifications, unreadCount, markAllRead, clearNotifications } = useStore();
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    const handleOpen = () => {
        setOpen(o => !o);
        if (unreadCount > 0) {
            markAllRead();
            authFetch(apiUrl('/api/notifications/read'), { method: 'POST' }).catch(error => console.warn('Notification read sync failed:', error.message));
        }
    };

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
        <div ref={containerRef} style={{ position: 'relative' }}>
            <button
                onClick={handleOpen}
                style={{
                    position: 'relative',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    padding: '0.35rem 0.6rem',
                    display: 'flex',
                    alignItems: 'center'
                }}
                title="Notifications"
            >
                <Bell size={18} />
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        background: 'var(--accent-red)',
                        color: '#fff',
                        borderRadius: '50%',
                        width: '16px',
                        height: '16px',
                        fontSize: '0.6rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700
                    }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: `${Math.min(340, window.innerWidth - 16)}px`,
                    background: 'var(--bg-card)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    zIndex: 1000,
                    overflow: 'hidden'
                }}>
                    <div style={{
                        padding: '0.75rem 1rem',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Notifications
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={markAllRead}
                                style={{
                                    background: 'none', border: 'none',
                                    color: 'var(--text-secondary)', cursor: 'pointer',
                                    fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem'
                                }}
                            >
                                <CheckCheck size={12} /> Mark all read
                            </button>
                            {notifications.length > 0 && (
                                <button
                                    onClick={clearNotifications}
                                    style={{
                                        background: 'none', border: 'none',
                                        color: 'rgba(255,69,58,0.6)', cursor: 'pointer',
                                        fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem'
                                    }}
                                    title="Clear all notifications"
                                >
                                    Clear all
                                </button>
                            )}
                        </div>
                    </div>

                    <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                        {notifications.length === 0 && (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                No notifications yet
                            </div>
                        )}
                        {notifications.map(notif => (
                            <div
                                key={notif.id}
                                style={{
                                    padding: '0.75rem 1rem',
                                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                                    display: 'flex',
                                    gap: '0.6rem',
                                    alignItems: 'flex-start',
                                    background: notif.read ? 'transparent' : 'rgba(10, 132, 255, 0.04)'
                                }}
                            >
                                <div style={{ paddingTop: '2px' }}>
                                    {TYPE_ICONS[notif.type] || <Zap size={14} color="var(--text-secondary)" />}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                                        {notif.title}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                                        {notif.body}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.2rem' }}>
                                        {new Date(notif.timestamp).toLocaleTimeString()}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
