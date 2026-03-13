// Vercel Serverless Function - fetches Instagram data
// Token stored in Vercel environment variable (INSTAGRAM_ACCESS_TOKEN)

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  
  if (!token) {
    return res.status(500).json({ error: 'Instagram token not configured' });
  }
  
  try {
    // Fetch profile info
    const profileRes = await fetch(
      `https://graph.instagram.com/me?fields=id,username,account_type,media_count,followers_count,follows_count&access_token=${token}`
    );
    const profile = await profileRes.json();
    
    if (profile.error) {
      return res.status(401).json({ error: 'Token expired or invalid', details: profile.error });
    }
    
    // Fetch recent posts
    const postsRes = await fetch(
      `https://graph.instagram.com/me/media?fields=id,caption,media_type,timestamp,permalink,like_count,comments_count&limit=50&access_token=${token}`
    );
    const postsData = await postsRes.json();
    
    // Calculate stats
    const posts = postsData.data || [];
    const totalLikes = posts.reduce((sum, p) => sum + (p.like_count || 0), 0);
    const totalComments = posts.reduce((sum, p) => sum + (p.comments_count || 0), 0);
    const avgLikes = posts.length ? Math.round(totalLikes / posts.length) : 0;
    const avgComments = posts.length ? Math.round(totalComments / posts.length) : 0;
    
    // Top 5 and bottom 5 posts
    const sortedByLikes = [...posts].sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
    const top5 = sortedByLikes.slice(0, 5);
    const bottom5 = sortedByLikes.slice(-5).reverse();
    
    // Get posts from last 7 days
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thisWeekPosts = posts.filter(p => new Date(p.timestamp) > oneWeekAgo);
    
    // Engagement rate (likes + comments) / followers
    const engagementRate = profile.followers_count 
      ? ((avgLikes + avgComments) / profile.followers_count * 100).toFixed(1)
      : 0;
    
    // Format posts for chart
    const chartData = posts.map(p => ({
      date: p.timestamp.split('T')[0],
      likes: p.like_count || 0,
      comments: p.comments_count || 0,
      title: p.caption ? p.caption.split('\n')[0].slice(0, 50) : 'Untitled'
    })).reverse(); // oldest first for chart
    
    return res.status(200).json({
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
        engagementRate,
        totalPosts: posts.length
      },
      top5: top5.map(p => ({
        title: p.caption ? p.caption.split('\n')[0].slice(0, 60) : 'Untitled',
        date: p.timestamp.split('T')[0],
        likes: p.like_count || 0,
        comments: p.comments_count || 0,
        permalink: p.permalink
      })),
      bottom5: bottom5.map(p => ({
        title: p.caption ? p.caption.split('\n')[0].slice(0, 60) : 'Untitled',
        date: p.timestamp.split('T')[0],
        likes: p.like_count || 0,
        comments: p.comments_count || 0,
        permalink: p.permalink
      })),
      thisWeek: thisWeekPosts.map(p => ({
        title: p.caption ? p.caption.split('\n')[0].slice(0, 60) : 'Untitled',
        date: p.timestamp.split('T')[0],
        likes: p.like_count || 0,
        comments: p.comments_count || 0,
        permalink: p.permalink
      })),
      chartData
    });
    
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch Instagram data', details: error.message });
  }
}
