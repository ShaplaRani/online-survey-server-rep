const express = require('express')
require('dotenv').config()
const cors = require('cors');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
// app.use(
//   cors({
//       origin: ['http://localhost:5173', 'https://enmmedia.web.app'],
//       credentials: true,
//   }),
// )
app.use(express.json());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ei0qpxt.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    //await client.connect();
    const userCollection = client.db("surveyDb").collection("users");
    const surveysCollection = client.db("surveyDb").collection("surveys");
    const packagesCollection = client.db("surveyDb").collection("packages");
    const commentCollection = client.db("surveyDb").collection("comment");
    const votedCollection = client.db("surveyDb").collection("voted");
    // jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '8h' });
      console.log(token);
      res.send({ token });
    })

    // middlewares 
    const verifyToken = (req, res, next) => {
      console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
    }
    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      console.log(user);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }

    //all user get
    //verifyToken,verifyAdmin,
    //** verifyAdmin, 
    app.get('/users', verifyToken,verifyAdmin, async (req, res) => {
        // const sorObj = {};
        // const sortField = req.query.sortField;
        //  const sortOrder = req.query.sortOrder;
        //  console.log(sortField, sortOrder);
        //  if(sortField && sortOrder){
        //   sorObj[sortField] = sortOrder
          
        // } 
      //const cursor = userCollection.find().sort(sorObj);
      const role = req.query.role;
      let queryObj = {};
      if(role ){
        queryObj.role  = role ;
      }
      const cursor = userCollection.find(queryObj);
      const result = await cursor.toArray();
      res.send(result);
    });
    

    //check admin
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    })
    //check surveyor
    app.get('/users/surveyor/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let surveyor = false;
      if (user) {
        surveyor = user?.role === 'surveyor';
      }
      res.send({ surveyor });
    })  
    //check proUser
    app.get('/users/proUser/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let surveyor = false;
      if (user) {
        surveyor = user?.role === 'pro-user';
      }
      res.send({ surveyor });
    })  

    //user create
    app.post('/users', async (req, res) => {
      const user = req.body;
      // insert email if user doesnt exists: 
      // you can do this many ways (1. email unique, 2. upsert 3. simple checking)
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    //verifyToken, verifyAdmin,
    //create surveyor
    app.patch('/users/admin',verifyToken,verifyAdmin,  async (req, res) => {
      const id = req.query.id;
      const status = req.query.role;
      console.log(id, status);
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: status
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      console.log(result);
      res.send(result);
    })

    //verifyToken, verifyAdmin,
    app.delete('/users/:id',   async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })

    //survey relater api
    
    app.get('/survey', async(req, res) => {
      const email = req.query?.email;
      let  query = {};
      if(email){
         query = {email: email}
      }

      
      const result = await surveysCollection.find(query).toArray();
      res.send(result)
  })

  //home page
  app.get('/recently-survey',async(req, res) => {
    const sortObj ={};
    const sortField = req.query.sortField;
    const sortOrder = req.query.sortOrder;
    if(sortField && sortOrder){
      sortObj[sortField] = sortOrder
    }
  
    const cursor = surveysCollection.find().sort(sortObj);
    const result = await cursor.toArray();
    res.send(result);
  })
  

  app.get('/survey/:id', async(req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await surveysCollection.find(query).toArray();
      res.send(result)
  })
  
    app.post('/create-survey',verifyToken, async(req, res) => {
      const product = req.body; console.log(product);
      const result = await surveysCollection.insertOne(product);
       res.send(result);
  })
  
 
  //todo: admin survey page unpublished
   app.patch('/survey-unpublished/:id',verifyToken, async(req, res) => {
      const id = req.params.id;
      const unpublished = req.body;
      
      console.log(id, unpublished);
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          feedback: unpublished.feedback,
          isPublish:false
        }
      }
      const result = await surveysCollection.updateOne(filter, updatedDoc)
      console.log(result);
      res.send(result)
  })
  //Todo:surveyor survey update {id, body}
  app.put('/surveyor/survey-update/:id', verifyToken, async(req, res) => {
    const id = req.params.id;
      const updateSurvey = req.body;
      
      console.log(id,updateSurvey);
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          title: updateSurvey.title,
          category: updateSurvey.category,
          description: updateSurvey.description
        }
      }
      const result = await surveysCollection.updateOne(filter, updatedDoc)
      console.log(result);
      res.send(result)
  })
  
  app.delete('/surveyor/survey-delete/:id',verifyToken, async(req,res) => {
    const id = req.params.id;
    console.log('survey deleted',id);
    const query = { _id: new ObjectId(id) }
    const result = await surveysCollection.deleteOne(query);
    console.log(result);
    res.send(result);
  })

  //user survey like and dislike
  app.patch('/survey-like-dislike',verifyToken,async (req, res) => {
    const id = req.query.id;
    const status = req.query.status;
    console.log(id, status);
    
    let updateDoc='';
    const filter = { _id: new ObjectId(id) };
    if(status === 'like'){
      updatedDoc = {
        $inc: {
          like: 1
        }
      }
    } else {
      updatedDoc = {
        $inc: {
          dislike: 1
        }
      }
    }
     
    const result = await surveysCollection.updateOne(filter, updatedDoc);
    console.log(result);
    res.send(result);
  })
  //user survey report 
  app.patch('/survey-report/:id',verifyToken, async(req, res) => {
    const id = req.params.id;
    
    
    console.log(id);
    const filter = { _id: new ObjectId(id) };
    const updatedDoc = {
      $set: {
       
        isReport:true
      }
    }
    const result = await surveysCollection.updateOne(filter, updatedDoc)
    console.log(result);
    res.send(result)
})
//title comment get
app.get('/comment',  async(req, res) => {
     
      const title = req.query?.title;
      const query = {
        title:title
      }
      
      const result = await commentCollection.find(query).toArray();
      res.send(result)
} )
//vote get 
app.get('/survey-vote', async(req, res) => {
  const result = await votedCollection.find().toArray();
  res.send(result)
})
app.get('/survey-vote/:title', async(req, res) => {
  const title = req.params.title;
  const query = { title: title }
  const result = await votedCollection.find(query).toArray();
  res.send(result)
})
 // pro-user commit create in survey
 app.post('/pro-user/create-comment',verifyToken, async(req, res) => {
  const comment = req.body; console.log(comment);
  const result = await commentCollection.insertOne(comment);
   res.send(result);
})

//vote create  votedCollection
app.post('/survey-vote', async(req, res) => {
  const voted = req.body; console.log(voted);
  const result = await votedCollection.insertOne(voted);
   res.send(result);
})




  //package related api 
     app.get('/packages', async(req, res) => {
      const result = await packagesCollection.find().toArray();
      res.send(result)
  })
     app.get('/packages/:id', async(req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await packagesCollection.find(query).toArray();
      res.send(result)
  })
       // payment intent
       app.post('/create-payment-intent', async (req, res) => {
        const { price } = req.body;
        const amount = parseInt(price * 100);
        console.log(amount, 'amount inside the intent')
  
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card']
        });
  
        res.send({
          clientSecret: paymentIntent.client_secret
        })
      });
      //user update 
      app.patch('/payments',verifyToken, async(req, res) => {
        console.log('pro user');
        const email= req.body.email;
        const proUser = req.body;
        
        console.log(email,proUser);
        const filter = { email: email };
        const updatedDoc = {
          $set: {
            transactionId: proUser.transactionId,
            price: proUser.price,
            date: proUser.date,
            package: proUser.package,
            role:proUser.role
          }
          
          
        }
        const result = await userCollection.updateOne(filter, updatedDoc)
        console.log(result);
        res.send(result)
    })
    // Send a ping to confirm a successful connection
    //await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('survey is setting')
})
app.listen(port, () => {
  console.log(`survey is sitting on port:${port}`);
})