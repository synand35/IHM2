const express=require('express')
const mysql=require('mysql')
const myconnection=require('express-myconnection')
const { urlencoded } = require('express')
const connection = require('express-myconnection')
const jwt=require('jsonwebtoken')
const nodemailer = require('nodemailer')
const fs =require('fs')
const session = require('express-session');



// jsonWebToken
var token = jwt.sign({ foo: 'bar' }, 'shhhhh');
var privateKey = fs.readFileSync('private.key');


const app=express()

//session
app.use(session({
  secret: 'synand',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Utilisez secure: true en production
}));

//Middleware pour configurer les en-tetes de cache
app.use((req,res,next)=>{
    res.setHeader('Cache-Control','no-store,no-cahe,mut-revalidate,proxy-revalidate');
    res.setHeader('Pragma','no-cache');
    res.setHeader('Expires','0');
    res.setHeader('Surrogate-Control','no-store');
    next();
});

//Middleware pour proteger les routes
const isAuthenticated=(req,res,next)=>{
    if(req.session.email){
        next();
    }
    else{
        res.redirect('/')
    }
}
//  isAuthenticated();

 //connection base de donnee
const optionConnection={
    host:"localhost",
    user:"root",
    passowrd:"",
    port:"3306",
    database:"gestrdv"
}


app.use(myconnection(mysql,optionConnection,'pool'))

const isConnected=(req,res,next)=>{
    req.getConnection((erreur,connection)=>{
        if(erreur){
            console.log("Connection base de donnee echoue");
            res.redirect('/?message1=Connection base de donnee echoue')
        }
        else{
            next();
        }

    })
}
app.use(express.urlencoded({extended:false}))

app.set('view engine','ejs')
app.set('views','Clinique')

app.use(express.static('Clinique'))

//date heure actuel
const dateActuel=new Date()
const heureActuel=dateActuel.getHours()
const minuteActuel=dateActuel.getMinutes()
const secondeActuel=dateActuel.getSeconds()
const horaire= heureActuel+":"+minuteActuel+":"+secondeActuel

// Creation du fichier journal 
if(!fs.existsSync('journal.txt')){
    fs.writeFile('journal.txt','#Journal',()=>{
        })
}

app.get('/',(req,res)=>{
 res.render("acceuil")
})

app.post('/add',isConnected,(req,res)=>{
    let nom=req.body.nom
    let email=req.body.email
    let password=req.body.password
    req.getConnection((erreur,connection)=>{
        if(erreur) throw erreur
        connection.query("insert into  user1 (username,email,password) values (?,?,?)",
        [nom,email,password],
        (erreur,resultat)=>{
            if(erreur) throw erreur
            const donnee="\n"+horaire+""+"creation utilisateur"+nom+" "+email
            fs.appendFile('journal.txt',donnee,()=>{})
            res.redirect('/?message=Le compte d\'utilisateur est creé avec succe, veuillez identifier pour connecter')
        }
        )

    })
})

app.get('/home',isAuthenticated,(req,res)=>{
    req.getConnection((erreur,connection)=>{
        if(erreur) throw erreur
        connection.query("SELECT rdvuser.id AS id,rdvuser.date AS date,rdvuser.heure AS heure,rdvuser.motif AS motif,rdvuser.etat AS etat, user1.username AS nom,rdvuser.idUser AS idUser,user1.email AS email,rdvuser.date1 AS date1,rdvuser.heure1 AS heure1  FROM rdvuser,user1 WHERE rdvuser.idUser=user1.id AND user1.email='"+req.session.email+"' ORDER by rdvuser.id DESC",[],(erreur,resultat1)=>{
            if(erreur) throw erreur
            connection.query("select id,email from user1 where email='"+req.session.email+"'",[],(erreur,resultat2)=>{
                if(erreur) throw erreur
                let email=req.session.email;
                res.status(200).render('home',{result:resultat1,id:resultat2[0].id,email})
            })
            
        })
    })

})
app.post('/auth',isConnected,(req,res)=>
{
    console.log(req.body)
    let name=req.body.name
    let pass=req.body.password
    req.getConnection((erreur,connection)=>{
        if(erreur) throw erreur
        connection.query("select username, password,email from user1 where username like'"+name+"' and password like'"+pass+"'",[],(erreur,result1)=>{
            if(erreur) throw erreur
            if(result1.length==0){
                console.log("login incorrect")
                res.status(200).redirect('/?error=Nom d\'utilisateur ou mot de passe incorrect.veuillez réssayer.')
            }
            else{
                
                    // sign with RSA SHA256
                    var token = jwt.sign({ foo: 'bar' }, privateKey, { algorithm: 'RS256' });

                    //journalisation
                        let donnee="\n"+dateActuel.toLocaleDateString()+"  "+heureActuel+":"+minuteActuel+":"+secondeActuel+" Utlisateur connecté "+name 
                        fs.appendFile('journal.txt',donnee,()=>{
                            // console.log("ecrture du fichier avec susee")
                        })
                    
                        req.session.email=result1[0].email
                    //    let nom=req.session.email
                    res.status(200).redirect('planing')
                 
            }
        })
    })
})


app.get('/notification',isAuthenticated,(req,res)=>{
    req.getConnection((erreur,connection)=>{
        if(erreur) throw erreur
            connection.query("SELECT rdvuser.id AS id,rdvuser.date AS date,rdvuser.heure AS heure,rdvuser.motif AS motif,rdvuser.etat AS etat, user1.username AS nom,rdvuser.idUser AS idUser,user1.email AS email,rdvuser.date1 AS date1,rdvuser.heure1 AS heure1 , rdvuser.date2 as datePasse ,heure2 as heurePasse FROM rdvuser,user1 WHERE rdvuser.idUser=user1.id AND email='"+req.session.email+"' AND rdvuser.etat !='En attente' ORDER by rdvuser.id DESC",[],(erreur1,resultat1)=>{
                if(erreur1) throw erreur1
                let email=req.session.email
                    res.status(200).render('notification',{email,resultat1})

            })
        
    })
})


app.post('/addRdvUser',(req,res)=>{
    // let id=req.body.id
    let etat='En attente'
    let id=req.body.id
    let motif=req.body.motif
    let date=req.body.date
    let heure=req.body.heure
    req.getConnection((erreur,connection)=>{
        if(erreur) throw erreur
        connection.query("select DAYOFWEEK('"+date+"') AS date",[],(erreur,resultatDate)=>{
            if(erreur) throw erreur
            console.log(resultatDate[0].date);
            if(resultatDate[0].date==1 || resultatDate[0].date==7){
               
                res.status(200).redirect('home?error=Nous somme indisponible le week-end, veuillez choisir une autre')
            }
            else{
                connection.query("select id from rdvuser where date='"+date+"' AND heure='"+heure+"'",[],(erreur1,resultat1)=>{
                    if(erreur1) throw erreur1
                    if(resultat1.length!=0){
                        // console.log(date.getDay());
                        res.status(200).redirect('home?error=Temps indisponible, veuillez choisir une autre')
                    }
                    
                    else{
                        connection.query("insert into  rdvuser(motif,date,heure,idUser,date1,heure1) values(?,?,?,?,CURDATE(),CURTIME())",[motif,date,heure,id],(erreur,resultat)=>{
                            if(erreur) throw erreur
                            const donnee="\n"+horaire+""+" creation rendez-vous"+id+" "+motif+" "+date+" "+heure
                            fs.appendFile('journal.txt',donnee,()=>{})
                            res.status(200).redirect('home')
                        })
                    }
                    
                })
            }
        })
      
    })
})

app.get('/planing',isAuthenticated,(req,res)=>{
    req.getConnection((erreur,connection)=>{
        if(erreur) throw erreur
        connection.query("SELECT rdvuser.heure,rdvuser.motif,DAYOFWEEK(rdvuser.date) as jour FROM rdvuser,semaine where etat='Accorde' AND rdvuser.date BETWEEN semaine.debut AND semaine.fin ORDER BY heure ASC",[],(erreur1,resultat)=>{
            if(erreur1) throw erreur1;
            connection.query("SELECT id from rdvuser where etat='En attente'",[],(erreur1,resultat1)=>{
                if(erreur1) throw erreur1
                connection.query("select email from user1 where online='1'",[],(erreur2,resultat2)=>{
                    if(erreur2) throw erreur2
                    // res.status(200).render('planing',{resultat,result1:resultat1,nom:resultat2[0].email})
                    connection.query("select debut,fin from semaine",[],(erreur2,resultat3)=>{
                        if(erreur2) throw erreur2
                        let email=req.session.email
                        console.log(resultat);
                        res.status(200).render('planing',{resultat,result1:resultat1,nom:email,resultat3})
                    })
                })
            })
            
         })
     })
app.get('/SemaineAdd',isAuthenticated,(req,res)=>{
    req.getConnection((erreur,connection)=>{
        if(erreur) throw erreur
        connection.query("UPDATE semaine set  debut=debut+7 ,fin=fin+7",[],(erreur,result)=>{
            if(erreur) throw erreur
            res.status(200).redirect('planing')
        })

    })
})
app.get('/SemaineDel',isAuthenticated,(req,res)=>{
    req.getConnection((erreur,connection)=>{
        if(erreur) throw erreur
        connection.query("UPDATE semaine set  debut=debut-7 ,fin=fin-7",[],(erreur,result)=>{
            if(erreur) throw erreur
            res.status(200).redirect('planing')
        })

    })
})

app.get('/SemaineAdd1',(req,res)=>{
    req.getConnection((erreur,connection)=>{
        if(erreur) throw erreur
        connection.query("UPDATE semaine set  debut=debut+7 ,fin=fin+7",[],(erreur,result)=>{
            if(erreur) throw erreur
            // console.log("date+");
            res.status(200).redirect('planingAdmin')
        })

    })
})
app.get('/SemaineDel1',(req,res)=>{
    req.getConnection((erreur,connection)=>{
        if(erreur) throw erreur
        connection.query("UPDATE semaine set  debut=debut-7 ,fin=fin-7",[],(erreur,result)=>{
            if(erreur) throw erreur
            res.status(200).redirect('planingAdmin')
        })

    })
})

})
app.get('/deconnection',(req,res)=>{
    req.getConnection((erreur,connection)=>{
    if(erreur) throw erreur
     
        jwt.sign({ foo: 'bar' }, privateKey, { algorithm: 'RS256' }, function(err, token) {
        console.log(token);
        });
        let donnee="\n"+dateActuel.toLocaleDateString()+"  "+heureActuel+":"+minuteActuel+":"+secondeActuel+" Utlisateur Deconnecté " 
                fs.appendFile('journal.txt',donnee,()=>{
                    // console.log("ecrture du fichier avec susee")
                    })
        req.session.destroy(err=>{
            if(err){
                console.error("erreur lors de la destrucion du session")
            }
            else{
                console.log("le session est detruit");
            }
        });
        res.clearCookie('connect.sid');
        res.redirect('/')
        
     })
    

})

// Admin

app.get('/planingAdmin',(req,res)=>{
    req.getConnection((erreur,connection)=>{
        if(erreur) throw erreur
        connection.query("SELECT rdvuser.heure,rdvuser.motif,DAYOFWEEK(rdvuser.date) as jour FROM rdvuser,semaine where etat='Accorde' AND rdvuser.date BETWEEN semaine.debut AND semaine.fin ORDER BY heure ASC",[],(erreur1,resultat)=>{
            if(erreur1) throw erreur1;
            connection.query("SELECT id from rdvuser where etat='En attente'",[],(erreur1,resultat1)=>{
                if(erreur1) throw erreur1
                connection.query("select debut,fin from semaine",[],(erreur2,resultat3)=>{
                    if(erreur2) throw erreur2
                    res.status(200).render('planingAdmin',{resultat,result1:resultat1,resultat3})
                })
            })
            
         })
     })

})
app.post('/authAdmin',(req,res)=>
{
    let name=req.body.name
    let pass=req.body.password
    console.log(name)
    console.log(pass);
    req.getConnection((erreur,connection)=>{
        if(erreur) throw erreur
        connection.query("select username, password from admin1 where username like'"+name+"' and password like'"+pass+"'",[],(erreur,result)=>{
            if(erreur) throw erreur
            if(result.length==0){
                console.log("login incorrect")
                const donnee="\n"+horaire+""+"Administateur connecté login incorrect"+" "+name
                 fs.appendFile('journal.txt',donnee,()=>{})
                res.status(200).redirect('/admin')
            }
            else{
                console.log("login correct")
                const donnee="\n"+horaire+" "+" Administateur connecté"+" "+name
                    fs.appendFile('journal.txt',donnee,()=>{})
                //    res.status(200).redirect('/admin')
                    res.status(200).redirect('/planingAdmin')
                    

            }
        })

    })
})

app.get('/admin',(req,res)=>{
    res.status(200).render('acceuilAdmin')
})

app.get('/homeAdmin',(req,res)=>{
    req.getConnection((erreur,connection)=>{
        if(erreur) throw erreur
        connection.query("SELECT rdvuser.id AS id,rdvuser.date AS date,rdvuser.heure AS heure,rdvuser.motif AS motif,rdvuser.etat AS etat, user1.username AS nom,rdvuser.idUser AS idUser,user1.email AS email,rdvuser.date1 AS date1,rdvuser.heure1 AS heure1  FROM rdvuser,user1 WHERE rdvuser.idUser=user1.id AND rdvuser.etat='En attente' order by rdvuser.id DESC",[],(erreur,resultat)=>{
            if(erreur) throw erreur
            // console.log(req.body);
            res.status(200).render('homeAdmin',{result:resultat})
            
        })
    })

})
app.get('/histo',(req,res)=>{
    req.getConnection((erreur,connection)=>{
        if(erreur) throw erreur
        connection.query("SELECT rdvuser.id AS id,rdvuser.date AS date,rdvuser.heure AS heure,rdvuser.motif AS motif,rdvuser.etat AS etat, user1.username AS nom,rdvuser.idUser AS idUser,user1.email AS email,rdvuser.date1 AS date1,rdvuser.heure1 AS heure1,rdvuser.date2 as date2  FROM rdvuser,user1 WHERE rdvuser.idUser=user1.id AND rdvuser.etat !='En attente' ORDER by id DESC",[],(erreur,resultat)=>{
            if(erreur) throw erreur
            connection.query("SELECT id from rdvuser where etat='En attente'",[],(erreur1,resultat1)=>{
                if(erreur1) throw erreur1
                    // console.log(resultat1)
                     res.status(200).render('histo',{result:resultat,result1:resultat1})
            })
            
        })
    })

})

app.post('/SearchHisto',(req,res)=>{
    let search=req.body.search
    req.getConnection((erreur,connection)=>{
        if(erreur) throw erreur
        connection.query("SELECT rdvuser.id AS id,rdvuser.date AS date,rdvuser.heure AS heure,rdvuser.motif AS motif,rdvuser.etat AS etat, user1.username AS nom,rdvuser.idUser AS idUser,user1.email AS email,rdvuser.date1 AS date1,rdvuser.heure1 AS heure1,rdvuser.date2 as date2  FROM rdvuser,user1 WHERE rdvuser.idUser=user1.id AND rdvuser.etat !='En attente' AND user1.username='"+search+"' ORDER by id DESC",[],(erreur,resultat)=>{
            if(erreur) throw erreur
            connection.query("SELECT id from rdvuser where etat='En attente'",[],(erreur1,resultat1)=>{
                if(erreur1) throw erreur1
                    // console.log(resultat1)
                    const donnee="\n"+horaire+""+"recherche "+search
                     fs.appendFile('journal.txt',donnee,()=>{})
                     res.status(200).render('histo',{result:resultat,result1:resultat1})
            })
            
        })
    })

})

app.post('/accorder',(req,res)=>{
    let id=req.body.id
    req.getConnection((erreur,connection)=>{
        if(erreur) throw erreur
        connection.query("update rdvuser set etat='Accorde',date2=CURDATE(),heure2=CURTIME() where id="+id+"",[],(erreur,resultat)=>{
            if(erreur) throw erreur
            // console.log(resultat);
            // Configurer le transporteur SMTP
                // let transporter = nodemailer.createTransport({
                //     service: 'gmail',
                //     auth: {
                //         user: 'votre_adresse@gmail.com',
                //         pass: 'votre_mot_de_passe'
                //     }
                // });
                // var transport = nodemailer.createTransport({
                //     host: "sandbox.smtp.mailtrap.io",
                //     port: 2525,
                //     auth: {
                //       user: "6cc9d4c6cce8a8",
                //       pass: "970fd8a6d3bdbe"
                //     }
                //   });

                // // Définir les options de l'e-mail
                // let mailOptions = {
                //     from: 'votre_adresse@gmail.com',
                //     to: 'synand35@gmail.com',
                //     subject: 'Test d\'e-mail avec Node.js',
                //     text: 'Ceci est un e-mail de test envoyé depuis Node.js.'
                // };

                // // Envoyer l'e-mail
                // transporter.sendMail(mailOptions, function(error, info){
                //     if (error) {
                //         console.log(error);
                //     } else {
                //         console.log('E-mail envoyé: ' + info.response);
                //     }
                // });
                const donnee="\n"+horaire+""+"rendez-vous accordé id"+id
                fs.appendFile('journal.txt',donnee,()=>{})
            res.status(200).redirect('homeAdmin')
            
        })
    })
})
app.post('/Refuser',(req,res)=>{
    let id=req.body.id
    req.getConnection((erreur,connection)=>{
        if(erreur) throw erreur
        connection.query("update rdvuser set etat='Refuse', date2=CURDATE(),heure2=CURTIME() where id="+id+"",[],(erreur,resultat)=>{
            if(erreur) throw erreur
            // console.log(resultat);
            const donnee="\n"+horaire+""+"rendez-vous refusé id"+id
            fs.appendFile('journal.txt',donnee,()=>{})
            res.status(200).redirect('homeAdmin')
            
        })
    })
})

app.post('/Search',(req,res)=>{
    let search=req.body.search
    req.getConnection((erreur,connection)=>{
        if(erreur) throw erreur
        connection.query("SELECT rdvuser.id AS id,rdvuser.date AS date,rdvuser.heure AS heure,rdvuser.motif AS motif,rdvuser.etat AS etat, user1.username AS nom,rdvuser.idUser AS idUser,user1.email AS email,rdvuser.date1 AS date1,rdvuser.heure1 AS heure1  FROM rdvuser,user1 WHERE rdvuser.idUser=user1.id AND rdvuser.etat='En attente' AND user1.username='"+search+"' ",[],(erreur,resultat)=>{
            if(erreur) throw erreur
            // console.log(req.body);
            res.status(200).render('homeAdmin',{result:resultat})
            
        })
    })

})

app.get('/deconnectionAdmin',(req,res)=>{
    const donnee="\n"+horaire+" "+"deconnection admin"
    fs.appendFile('journal.txt',donnee,()=>{})

        res.redirect('/admin')
       

})
// app.post('/Details',(req,res)=>{
//     req.getConnection((erreur,connection)=>{
//         if(erreur) throw erreur
//         connection.query("select * from rdvuser order by date desc",[],(erreur,resultat)=>{
//             if(erreur) throw erreur
//             console.log(resultat);
//             // res.status(200).render('home',{result1:resultat[0].username})
//             req.status(200).redirect("home")
//         })
//     })

// })

app.listen(3001)
console.log("attente de la requete du port 3001");
