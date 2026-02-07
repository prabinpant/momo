#!/bin/bash

echo "🔍 Momory Debug Test"
echo "===================="
echo ""

# Check database
if [ -f "db/memory.db" ]; then
    echo "✅ Database exists: db/memory.db"
    echo "   Size: $(du -h db/memory.db | cut -f1)"
    echo ""
    
    echo "📊 Database Contents:"
    echo "   Memories: $(sqlite3 db/memory.db "SELECT COUNT(*) FROM memories;")"
    echo "   Summaries: $(sqlite3 db/memory.db "SELECT COUNT(*) FROM summaries;")"
    echo "   Chunks: $(sqlite3 db/memory.db "SELECT COUNT(*) FROM summary_chunks;")"
    echo ""
    
    echo "📝 Recent Memories:"
    sqlite3 db/memory.db -header -column "SELECT type, substr(content,1,60) as content, datetime(created_at/1000, 'unixepoch') as created FROM memories ORDER BY created_at DESC LIMIT 5;"
    echo ""
else
    echo "❌ Database not found: db/memory.db"
    echo "   Will be created on first run"
    echo ""
fi

# Check logs
if [ -d "logs" ]; then
    echo "✅ Logs directory exists"
    if [ -f "logs/momo.log" ]; then
        echo "   Log file size: $(du -h logs/momo.log | cut -f1)"
        echo "   Last 3 lines:"
        tail -3 logs/momo.log
    else
        echo "   No log file yet"
    fi
else
    echo "⚠️  Logs directory missing - creating..."
    mkdir -p logs
fi

echo ""
echo "🚀 Ready to test!"
echo ""
echo "Commands:"
echo "  npm start           - Start interactive chat"
echo "  npm run test:manual - Run all tests"
echo "  ./debug-test.sh     - Run this script again"
