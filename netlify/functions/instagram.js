// Netlify Serverless Function - fetches Instagram data with full insights

exports.handler = async (event, context) => {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  
  if (!token) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Instagram token not configured' }) };
  }
  
  try {
    // Fetch profile info
    const profileRes = await fetch(
      `https://graph.instagram.com/me?fields=id,username,account_type,media_count,followers_count,follows_count&access_token=${token}`
    );
    const profile = await profileRes.json();
    
    if (profile.error) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Token expired or invalid', details: profile.error }) };
    }
    
    const userId = profile.id;
    
    // Fetch posts with insights (reach, saved, shares)
    const postsRes = await fetch(
      `https://graph.instagram.com/me/media?fields=id,caption,media_type,timestamp,permalink,like_count,comments_count,insights.metric(reach,saved,shares)&limit=50&access_token=${token}`
    );
    const postsData = await postsRes.json();
    
    // Fetch 28-day reach
    let reach28 = null;
    try {
      const reachRes = await fetch(
        `https://graph.instagram.com/${userId}/insights?metric=reach&period=days_28&access_token=${token}`
      );
      const reachData = await reachRes.json();
      if (reachData.data && reachData.data[0]) {
        reach28 = reachData.data[0].values[reachData.data[0].values.length - 1]?.value;
      }
    } catch (e) {}
    
    // Fetch follower demographics - city
    let topCities = [];
    try {
      const cityRes = await fetch(
        `https://graph.instagram.com/${userId}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=city&access_token=${token}`
      );
      const cityData = await cityRes.json();
      if (cityData.data && cityData.data[0]?.total_value?.breakdowns?.[0]?.results) {
        topCities = cityData.data[0].total_value.breakdowns[0].results
          .sort((a, b) => b.value - a.value)
          .slice(0, 5)
          .map(r => ({ city: r.dimension_values[0], count: r.value }));
      }
    } catch (e) {}
    
    // Fetch follower demographics - age/gender
    let demographics = { female: 0, male: 0, ageGroups: {} };
    try {
      const demoRes = await fetch(
        `https://graph.instagram.com/${userId}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=age,gender&access_token=${token}`
      );
      const demoData = await demoRes.json();
      if (demoData.data && demoData.data[0]?.total_value?.breakdowns?.[0]?.results) {
        demoData.data[0].total_value.breakdowns[0].results.forEach(r => {
          const [age, gender] = r.dimension_values;
          if (gender === 'F') demographics.female += r.value;
          if (gender === 'M') demographics.male += r.value;
          demographics.ageGroups[age] = (demographics.ageGroups[age] || 0) + r.value;
        });
      }
    } catch (e) {}
    
    // Process posts
    const posts = postsData.data || [];
    
    // Extract insights from posts
    const postsWithInsights = posts.map(p => {
      const insights = { reach: 0, saved: 0, shares: 0 };
      if (p.insights?.data) {
        p.insights.data.forEach(i => {
          if (i.name === 'reach') insights.reach = i.values[0]?.value || 0;
          if (i.name === 'saved') insights.saved = i.values[0]?.value || 0;
          if (i.name === 'shares') insights.shares = i.values[0]?.value || 0;
        });
      }
      return { ...p, insights };
    });
    
    // Calculate stats
    const totalLikes = posts.reduce((sum, p) => sum + (p.like_count || 0), 0);
    const totalComments = posts.reduce((sum, p) => sum + (p.comments_count || 0), 0);
    const totalSaved = postsWithInsights.reduce((sum, p) => sum + p.insights.saved, 0);
    const totalShares = postsWithInsights.reduce((sum, p) => sum + p.insights.shares, 0);
    const totalReach = postsWithInsights.reduce((sum, p) => sum + p.insights.reach, 0);
    
    const avgLikes = posts.length ? Math.round(totalLikes / posts.length) : 0;
    const avgComments = posts.length ? Math.round(totalComments / posts.length) : 0;
    const avgSaved = posts.length ? (totalSaved / posts.length).toFixed(1) : 0;
    const avgShares = posts.length ? (totalShares / posts.length).toFixed(1) : 0;
    const avgReach = posts.length ? Math.round(totalReach / posts.length) : 0;
    
    // Engagement rate
    const engagementRate = profile.followers_count 
      ? ((avgLikes + avgComments) / profile.followers_count * 100).toFixed(1)
      : 0;
    
    // Top/bottom posts
    const sortedByLikes = [...posts].sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
    const top5 = sortedByLikes.slice(0, 5);
    const bottom5 = sortedByLikes.slice(-5).reverse();
    
    // This week posts
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thisWeekPosts = posts.filter(p => new Date(p.timestamp) > oneWeekAgo);
    
    // Best posting time analysis
    const hourStats = {};
    const dayStats = {};
    posts.forEach(p => {
      const date = new Date(p.timestamp);
      const hour = date.getUTCHours();
      const day = date.toLocaleDateString('en-US', { weekday: 'long' });
      
      if (!hourStats[hour]) hourStats[hour] = { total: 0, count: 0 };
      hourStats[hour].total += p.like_count || 0;
      hourStats[hour].count++;
      
      if (!dayStats[day]) dayStats[day] = { total: 0, count: 0 };
      dayStats[day].total += p.like_count || 0;
      dayStats[day].count++;
    });
    
    let bestHour = null, bestHourAvg = 0;
    for (const [hour, stats] of Object.entries(hourStats)) {
      const avg = stats.total / stats.count;
      if (avg > bestHourAvg) { bestHourAvg = avg; bestHour = parseInt(hour); }
    }
    
    let bestDay = null, bestDayAvg = 0;
    for (const [day, stats] of Object.entries(dayStats)) {
      const avg = stats.total / stats.count;
      if (avg > bestDayAvg) { bestDayAvg = avg; bestDay = day; }
    }
    
    // Content type breakdown
    const contentTypes = {};
    posts.forEach(p => {
      const type = p.media_type || 'IMAGE';
      contentTypes[type] = (contentTypes[type] || 0) + 1;
    });
    
    // Hashtag analysis
    const hashtagStats = {};
    postsWithInsights.forEach(p => {
      const hashtags = (p.caption || '').match(/#\w+/g) || [];
      hashtags.forEach(tag => {
        if (!hashtagStats[tag]) hashtagStats[tag] = { total: 0, count: 0 };
        hashtagStats[tag].total += p.like_count || 0;
        hashtagStats[tag].count++;
      });
    });
    
    const topHashtags = Object.entries(hashtagStats)
      .map(([tag, stats]) => ({ tag, avgLikes: Math.round(stats.total / stats.count), count: stats.count }))
      .filter(h => h.count >= 2)
      .sort((a, b) => b.avgLikes - a.avgLikes)
      .slice(0, 10);
    
    // Chart data
    const chartData = postsWithInsights.map(p => ({
      date: p.timestamp.split('T')[0],
      time: p.timestamp.split('T')[1]?.slice(0, 5) || '',
      likes: p.like_count || 0,
      comments: p.comments_count || 0,
      reach: p.insights.reach,
      saved: p.insights.saved,
      shares: p.insights.shares,
      title: p.caption ? p.caption.split('\n')[0].slice(0, 50) : 'Untitled',
      type: p.media_type
    })).reverse();
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        lastUpdated: new Date().toISOString(),
        profile: {
          username: profile.username,
          followers: profile.followers_count,
          following: profile.follows_count,
          postsCount: profile.media_count,
          accountType: profile.account_type
        },
        stats: {
          avgLikes,
          avgComments,
          avgSaved: parseFloat(avgSaved),
          avgShares: parseFloat(avgShares),
          avgReach,
          engagementRate: parseFloat(engagementRate),
          totalPosts: posts.length,
          reach28: reach28
        },
        insights: {
          bestHour,
          bestHourAvg: Math.round(bestHourAvg),
          bestDay,
          bestDayAvg: Math.round(bestDayAvg),
          contentTypes,
          topHashtags,
          demographics,
          topCities
        },
        top5: top5.map(p => {
          const pi = postsWithInsights.find(x => x.id === p.id);
          return {
            title: p.caption ? p.caption.split('\n')[0].slice(0, 60) : 'Untitled',
            date: p.timestamp.split('T')[0],
            likes: p.like_count || 0,
            comments: p.comments_count || 0,
            saved: pi?.insights.saved || 0,
            shares: pi?.insights.shares || 0,
            reach: pi?.insights.reach || 0,
            permalink: p.permalink
          };
        }),
        bottom5: bottom5.map(p => {
          const pi = postsWithInsights.find(x => x.id === p.id);
          return {
            title: p.caption ? p.caption.split('\n')[0].slice(0, 60) : 'Untitled',
            date: p.timestamp.split('T')[0],
            likes: p.like_count || 0,
            comments: p.comments_count || 0,
            saved: pi?.insights.saved || 0,
            shares: pi?.insights.shares || 0,
            reach: pi?.insights.reach || 0,
            permalink: p.permalink
          };
        }),
        thisWeek: thisWeekPosts.map(p => {
          const pi = postsWithInsights.find(x => x.id === p.id);
          return {
            title: p.caption ? p.caption.split('\n')[0].slice(0, 60) : 'Untitled',
            date: p.timestamp.split('T')[0],
            likes: p.like_count || 0,
            comments: p.comments_count || 0,
            saved: pi?.insights.saved || 0,
            shares: pi?.insights.shares || 0,
            reach: pi?.insights.reach || 0,
            permalink: p.permalink
          };
        }),
        chartData
      })
    };
    
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch Instagram data', details: error.message }) };
  }
};
