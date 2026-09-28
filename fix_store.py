import io
with io.open("frontend/js/store.js", "r", encoding="utf-8") as f:
    content = f.read()

target = """    getUser(userId) {
        if (!this.db || !this.db.users) return { id: userId, name: 'User', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' };
        return this.db.users.find(u => u.id === userId) || { id: userId, name: 'Mukaputa User', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' };
    }"""

replacement = """    getUser(userId) {
        if (!this.db || !this.db.users) return { id: userId, name: 'User', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' };
        
        const actualUser = this.db.users.find(u => u.id === userId);
        if (this.isBlocked(userId)) {
            if (actualUser) {
                return { ...actualUser, isBlockedPlaceholder: true };
            }
            return { id: userId, name: 'Mukaputa User', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', isBlockedPlaceholder: true };
        }
        
        return actualUser || { id: userId, name: 'Mukaputa User', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' };
    }"""

if target in content:
    content = content.replace(target, replacement)
    with io.open("frontend/js/store.js", "w", encoding="utf-8") as f:
        f.write(content)
    print("Store replaced successfully")
else:
    print("Store target not found")
